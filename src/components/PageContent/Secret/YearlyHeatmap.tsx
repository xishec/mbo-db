import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Button, Select, SelectItem, Chip, Input } from "@heroui/react";
import type { BirdEvent, BirdEventType, DETsMap } from "../../../types";
import { BirdEventType as EventType } from "../../../types";
import { useData } from "../../../services/useData";

interface YearlyHeatmapProps {
  data: BirdEvent[];
}

export default function YearlyHeatmap({ data }: YearlyHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null>(null);
  const { DETsMap } = useData();
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(
    new Set([EventType.Banded, EventType.Return, EventType.Repeat, EventType.Alien])
  );
  const [speciesSearch, setSpeciesSearch] = useState("");

  // Valid nets - only show events from these nets
  const VALID_NETS = new Set([
    "A1", "A2", "B2", "B3", "C1", "C2", "D1", "D2", "D3", "D4",
    "E1", "E2", "H1", "H2", "N1", "N3"
  ]);

  // Filter data to only include events from valid nets
  const validNetData = useMemo(() => {
    return data.filter((event) => VALID_NETS.has(event.net));
  }, [data, VALID_NETS]);

  // Get all unique species sorted by count
  const allSpecies = useMemo(() => {
    const speciesCounts = d3.rollup(
      validNetData,
      (v) => v.length,
      (d) => d.species
    );
    return Array.from(speciesCounts, ([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count);
  }, [validNetData]);

  // Initialize with first species (computed once on mount)
  const [selectedSpecies, setSelectedSpecies] = useState<string>(() => {
    if (validNetData.length === 0) return "";
    const speciesCounts = d3.rollup(
      validNetData,
      (v) => v.length,
      (d) => d.species
    );
    const sorted = Array.from(speciesCounts, ([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count);
    return sorted.length > 0 ? sorted[0].species : "";
  });

  // Filter species based on search
  const filteredSpeciesList = useMemo(() => {
    if (!speciesSearch) return allSpecies;
    return allSpecies.filter((s) =>
      s.species.toLowerCase().includes(speciesSearch.toLowerCase())
    );
  }, [allSpecies, speciesSearch]);

  // Toggle event type
  const toggleEventType = (eventType: string) => {
    const newSet = new Set(selectedEventTypes);
    if (newSet.has(eventType)) {
      newSet.delete(eventType);
    } else {
      newSet.add(eventType);
    }
    setSelectedEventTypes(newSet);
  };

  // Select species (only one at a time)
  const selectSpecies = (species: string) => {
    setSelectedSpecies(species);
  };

  // Filter data based on selections
  const filteredData = useMemo(() => {
    if (!selectedSpecies) return [];
    return validNetData.filter((d) => {
      const eventTypeMatch = selectedEventTypes.has(d.birdEventType);
      const speciesMatch = selectedSpecies === d.species;
      return eventTypeMatch && speciesMatch;
    });
  }, [validNetData, selectedEventTypes, selectedSpecies]);

  useEffect(() => {
    if (!canvasRef.current || !svgRef.current || !containerRef.current || filteredData.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get container width for responsive chart
    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 40, right: 120, bottom: 60, left: 80 };
    const width = containerWidth - margin.left - margin.right;

    // Get unique years from data
    const years = Array.from(new Set(filteredData.map((d) => new Date(d.date).getFullYear()))).sort();
    const rowHeight = 40; // Height per year row
    const height = years.length * rowHeight;

    // Set canvas size (with pixel ratio for retina displays)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (width + margin.left + margin.right) * dpr;
    canvas.height = (height + margin.top + margin.bottom) * dpr;
    canvas.style.width = `${width + margin.left + margin.right}px`;
    canvas.style.height = `${height + margin.top + margin.bottom}px`;
    ctx.scale(dpr, dpr);
    ctx.translate(margin.left, margin.top);

    // Create SVG with clip path for zooming
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add clip path to prevent drawing outside chart area
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    // Reuse tooltip or create if first render
    let tooltip = tooltipRef.current;
    if (!tooltip) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.9)")
        .style("color", "white")
        .style("padding", "10px")
        .style("border-radius", "6px")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .style("font-size", "12px")
        .style("opacity", 0);
      tooltipRef.current = tooltip;
    }

    // Group data by year and week-of-year
    const heatmapData: {
      year: number;
      weekOfYear: number;
      weekStart: Date;
      weekEnd: Date;
      totalRate: number;
      counts: Map<string, number>;
      netHours: number;
      totalCount: number;
    }[] = [];

    // Helper to get week of year (1-53)
    const getWeekOfYear = (date: Date): number => {
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const diff = date.getTime() - startOfYear.getTime();
      const oneWeek = 1000 * 60 * 60 * 24 * 7;
      return Math.floor(diff / oneWeek) + 1;
    };

    // Group by year and week
    const weeklyGrouped = new Map<string, {
      year: number;
      weekOfYear: number;
      dates: Date[];
      counts: Map<string, number>;
      netHours: number;
      totalCount: number;
    }>();

    // First pass: collect all dates with DET data
    Object.keys(DETsMap).forEach((dateStr) => {
      const det = DETsMap[dateStr];
      const netHours = det?.netHours?.total ? parseFloat(det.netHours.total) : 0;

      if (netHours > 0) {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const weekOfYear = getWeekOfYear(date);
        const key = `${year}-W${weekOfYear}`;

        if (!weeklyGrouped.has(key)) {
          weeklyGrouped.set(key, {
            year,
            weekOfYear,
            dates: [],
            counts: new Map(),
            netHours: 0,
            totalCount: 0,
          });
        }

        const weekData = weeklyGrouped.get(key)!;
        weekData.dates.push(date);
        weekData.netHours += netHours;

        // Count events for this date
        const eventsOnDate = filteredData.filter((e) => e.date === dateStr);
        eventsOnDate.forEach((event) => {
          const current = weekData.counts.get(event.birdEventType) || 0;
          weekData.counts.set(event.birdEventType, current + 1);
          weekData.totalCount++;
        });
      }
    });

    // Second pass: create heatmap data from weekly aggregates
    weeklyGrouped.forEach((weekData) => {
      const totalRate = weekData.netHours > 0 ? weekData.totalCount / weekData.netHours : 0;
      const sortedDates = weekData.dates.sort((a, b) => a.getTime() - b.getTime());

      heatmapData.push({
        year: weekData.year,
        weekOfYear: weekData.weekOfYear,
        weekStart: sortedDates[0],
        weekEnd: sortedDates[sortedDates.length - 1],
        totalRate,
        counts: weekData.counts,
        netHours: weekData.netHours,
        totalCount: weekData.totalCount,
      });
    });

    if (heatmapData.length === 0) return;

    // Create scales
    // X-axis: Week 1 to Week 53
    const xScale = d3
      .scaleLinear()
      .domain([1, 53]) // Week of year
      .range([0, width]);

    // Y-axis: One row per year
    const yScale = d3
      .scaleBand()
      .domain(years.map(String))
      .range([0, height])
      .padding(0.1);

    // Color scale for heatmap intensity
    // Use 90th percentile to prevent outliers from washing out colors
    const rates = heatmapData
      .map((d) => d.totalRate)
      .filter((r) => r > 0)
      .sort((a, b) => a - b); // Sort ascending for quantile

    // Use 90th percentile as max threshold (adjustable: try 85, 90, or 95)
    const percentileThreshold = d3.quantile(rates, 0.90) || d3.max(rates) || 0.1;

    const colorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, percentileThreshold])
      .clamp(true); // Clamp values above threshold to max color

    // Calculate cell dimensions
    const cellWidth = width / 53;
    const cellHeight = yScale.bandwidth();

    // Draw heatmap cells on canvas (much faster than SVG)
    heatmapData.forEach((d) => {
      const x = xScale(d.weekOfYear);
      const y = yScale(String(d.year)) || 0;
      const fillColor = d.totalRate > 0 ? colorScale(d.totalRate) : "#f0f0f0";

      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, cellWidth, cellHeight);

      // Cell border
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, cellWidth, cellHeight);
    });

    // Set canvas cursor
    canvas.style.cursor = "pointer";

    // Track selected cell data
    let selectedData: typeof heatmapData[0] | null = null;

    // Helper to find cell at mouse position (optimized with early bounds check)
    const findCellAtPosition = (mouseX: number, mouseY: number): typeof heatmapData[0] | null => {
      const rect = canvas.getBoundingClientRect();
      const x = mouseX - rect.left - margin.left;
      const y = mouseY - rect.top - margin.top;

      // Early bounds check
      if (x < 0 || x > width || y < 0 || y > height) return null;

      // Calculate which week and year based on position
      const weekOfYear = Math.floor(xScale.invert(x));
      const yearStr = Array.from(yScale.domain()).find((yr) => {
        const yPos = yScale(yr) || 0;
        return y >= yPos && y <= yPos + cellHeight;
      });

      if (!yearStr) return null;

      // Find exact match
      return heatmapData.find((d) => d.weekOfYear === weekOfYear && String(d.year) === yearStr) || null;
    };

    // Redraw canvas with selection highlight
    const redrawCanvas = () => {
      // Clear
      ctx.clearRect(-margin.left, -margin.top, canvas.width, canvas.height);
      ctx.save();

      // Redraw all cells
      heatmapData.forEach((d) => {
        const x = xScale(d.weekOfYear);
        const y = yScale(String(d.year)) || 0;
        const fillColor = d.totalRate > 0 ? colorScale(d.totalRate) : "#f0f0f0";

        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, cellWidth, cellHeight);

        // Border
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // Highlight selected cell
        if (selectedData && d === selectedData) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, cellWidth, cellHeight);
        }
      });

      ctx.restore();
    };

    // Click handler
    canvas.addEventListener("click", (event) => {
      const datum = findCellAtPosition(event.clientX, event.clientY);

      if (datum) {
        // Toggle selection
        if (selectedData === datum) {
          selectedData = null;
          tooltip.style("opacity", 0);
        } else {
          selectedData = datum;

          // Build event type breakdown
          let eventBreakdown = "";
          const eventTypes = Array.from(selectedEventTypes);
          eventTypes.forEach((type) => {
            const count = datum.counts.get(type) || 0;
            if (count > 0) {
              const rate = datum.netHours > 0 ? count / datum.netHours : 0;
              eventBreakdown += `${type}: ${count} (${rate.toFixed(3)}/nh)<br/>`;
            }
          });

          // Update tooltip
          tooltip
            .html(
              `<strong>Week ${datum.weekOfYear}, ${datum.year}</strong><br/>` +
              `${datum.weekStart.toLocaleDateString()} - ${datum.weekEnd.toLocaleDateString()}<br/>` +
              `Net Hours: ${datum.netHours.toFixed(2)}<br/>` +
              eventBreakdown +
              `<strong>Total Rate: ${datum.totalRate.toFixed(3)} birds/net-hour</strong>`
            )
            .style("left", `${event.clientX + 10}px`)
            .style("top", `${event.clientY + 10}px`)
            .style("opacity", 1);
        }

        redrawCanvas();
      }
    });

    // Click outside to deselect
    const outsideClickHandler = (event: MouseEvent) => {
      if (!canvas.contains(event.target as Node) && !tooltip.node()?.contains(event.target as Node)) {
        if (selectedData) {
          selectedData = null;
          tooltip.style("opacity", 0);
          redrawCanvas();
        }
      }
    };
    document.addEventListener("click", outsideClickHandler);;

    // Add axes
    // X-axis with month labels
    const monthStarts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]; // Approx day of year for each month
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const xAxis = g
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues(monthStarts)
          .tickFormat((d, i) => monthNames[i])
      );

    // Y-axis with year labels
    const yAxis = g
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale));

    // Style axes
    g.selectAll(".domain, .tick line").attr("stroke", "currentColor");
    g.selectAll(".tick text").attr("fill", "currentColor");

    // Add axis labels
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 10)
      .style("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("font-size", "14px")
      .text("Month");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left + 15)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("font-size", "14px")
      .text("Year");

    // Add color scale legend
    const legend = g
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width + 20}, 0)`);

    legend
      .append("text")
      .attr("x", 0)
      .attr("y", -10)
      .attr("fill", "currentColor")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("Rate (birds/net-hour)");

    // Create gradient for legend
    const legendHeight = 200;
    const legendWidth = 20;

    const defs = svg.select("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    // Add color stops
    for (let i = 0; i <= 10; i++) {
      gradient
        .append("stop")
        .attr("offset", `${i * 10}%`)
        .attr("stop-color", colorScale((percentileThreshold * i) / 10));
    }

    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

    // Add legend scale
    const legendScale = d3
      .scaleLinear()
      .domain([0, percentileThreshold])
      .range([legendHeight, 0]);

    // Add note about percentile
    legend
      .append("text")
      .attr("x", legendWidth + 50)
      .attr("y", legendHeight + 20)
      .attr("fill", "currentColor")
      .style("font-size", "10px")
      .style("font-style", "italic")
      .text("(90th percentile)");

    legend
      .append("g")
      .attr("transform", `translate(${legendWidth}, 0)`)
      .call(d3.axisRight(legendScale).ticks(5).tickFormat(d3.format(".2f")))
      .selectAll("text")
      .attr("fill", "currentColor");


    // Cleanup
    return () => {
      document.removeEventListener("click", outsideClickHandler);
    };
  }, [filteredData, selectedEventTypes, DETsMap]);

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Event Type Filters */}
        <div>
          <label className="text-sm font-semibold mb-2 block">Event Types:</label>
          <div className="flex flex-wrap gap-2">
            {[EventType.Banded, EventType.Return, EventType.Repeat, EventType.Alien].map((type) => (
              <Chip
                key={type}
                color={selectedEventTypes.has(type) ? "primary" : "default"}
                variant={selectedEventTypes.has(type) ? "solid" : "bordered"}
                onClick={() => toggleEventType(type)}
                style={{ cursor: "pointer" }}
              >
                {type}
              </Chip>
            ))}
          </div>
        </div>

        {/* Species Filters */}
        <div>
          <label className="text-sm font-semibold mb-2 block">
            Species: {selectedSpecies || "(None)"}
          </label>
          <Input
            placeholder="Search species..."
            value={speciesSearch}
            onChange={(e) => setSpeciesSearch(e.target.value)}
            size="sm"
            className="mb-2"
          />
          <div className="max-h-32 overflow-y-auto border border-default-200 rounded-lg p-2">
            <div className="flex flex-wrap gap-1">
              {filteredSpeciesList.slice(0, 50).map(({ species, count }) => (
                <Chip
                  key={species}
                  color={selectedSpecies === species ? "success" : "default"}
                  variant={selectedSpecies === species ? "solid" : "bordered"}
                  onClick={() => selectSpecies(species)}
                  size="sm"
                  style={{ cursor: "pointer" }}
                >
                  {species} ({count})
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="w-full overflow-x-auto bg-content1 p-4 rounded-lg">
        <div className="text-sm text-default-500 mb-2">
          💡 Heatmap showing weekly capture rates (birds per net-hour) across the year. Each row represents one year. Color intensity indicates capture rate.
          <br />
          Only showing events from nets: A1, A2, B2, B3, C1, C2, D1, D2, D3, D4, E1, E2, H1, H2, N1, N3. <strong>Click on cells</strong> to view details. Click again to deselect.
        </div>
        <div style={{ position: "relative" }}>
          <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0 }}></canvas>
          <svg ref={svgRef} style={{ position: "relative", pointerEvents: "none" }}></svg>
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm text-default-600">
        Showing {filteredData.length} events from valid nets for {selectedSpecies}
      </div>
    </div>
  );
}
