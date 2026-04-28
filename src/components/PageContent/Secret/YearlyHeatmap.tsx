import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Chip, Select, SelectItem } from "@heroui/react";
import { useData } from "../../../services/useData";
import { SPECIES_MAP } from "../../../types/species";

type ViewMode = "det" | "captured" | "observed";

export default function YearlyHeatmap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { DETsMap } = useData();

  const [viewMode, setViewMode] = useState<ViewMode>("det");
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Get all species sorted by count
  const allSpecies = useMemo(() => {
    const speciesCounts = new Map<string, number>();
    Object.values(DETsMap).forEach((det) => {
      Object.entries(det.DETSpeciesCount || {}).forEach(([species, count]) => {
        speciesCounts.set(species, (speciesCounts.get(species) || 0) + count);
      });
    });
    return Array.from(speciesCounts, ([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count);
  }, [DETsMap]);

  const [selectedSpecies, setSelectedSpecies] = useState<string>(() =>
    allSpecies.length > 0 ? allSpecies[0].species : ""
  );

  // Handle keyboard navigation for quick species and view mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isAutocompleteActive = autocompleteRef.current?.contains(activeElement);

      if (!isAutocompleteActive) {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const currentIndex = allSpecies.findIndex(s => s.species === selectedSpecies);
          if (currentIndex === -1) return;

          let newIndex;
          if (e.key === "ArrowUp") {
            newIndex = currentIndex > 0 ? currentIndex - 1 : allSpecies.length - 1;
          } else {
            newIndex = currentIndex < allSpecies.length - 1 ? currentIndex + 1 : 0;
          }

          const newSpecies = allSpecies[newIndex].species;
          setSelectedSpecies(newSpecies);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const modes: ViewMode[] = ["det", "captured", "observed"];
          const currentIndex = modes.indexOf(viewMode);

          let newIndex;
          if (e.key === "ArrowLeft") {
            newIndex = currentIndex > 0 ? currentIndex - 1 : modes.length - 1;
          } else {
            newIndex = currentIndex < modes.length - 1 ? currentIndex + 1 : 0;
          }

          setViewMode(modes[newIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSpecies, allSpecies, viewMode]);


  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !selectedSpecies) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 80, right: 180, bottom: 70, left: 80 };
    const width = containerWidth - margin.left - margin.right;

    // Get week of year (1-53)
    const getWeekOfYear = (date: Date): number => {
      const start = new Date(date.getFullYear(), 0, 1);
      const diff = date.getTime() - start.getTime();
      const oneWeek = 1000 * 60 * 60 * 24 * 7;
      return Math.floor(diff / oneWeek) + 1;
    };

    // Build weekly data based on view mode
    const weeklyMap = new Map<string, {
      year: number;
      week: number;
      count: number;
      netHours?: number;
      observerHours?: number;
    }>();

    Object.entries(DETsMap).forEach(([dateStr, det]) => {
      const netHours = parseFloat(det?.netHours?.total || "0");
      const observerHours = det?.observerHours?.total || 0;

      // Skip dates with no hours based on view mode
      if (viewMode === "captured" && netHours === 0) return;
      if (viewMode === "observed" && observerHours === 0) return;

      const date = new Date(dateStr);
      const year = date.getFullYear();
      const week = getWeekOfYear(date);
      const key = `${year}-${week}`;

      if (!weeklyMap.has(key)) {
        weeklyMap.set(key, { year, week, count: 0, netHours: 0, observerHours: 0 });
      }

      const data = weeklyMap.get(key)!;

      // Get count based on view mode
      let count = 0;
      if (viewMode === "det") {
        count = det.DETSpeciesCount?.[selectedSpecies] || 0;
      } else if (viewMode === "captured") {
        count = (det.bandedSpeciesCount?.[selectedSpecies] || 0) +
                (det.repeatSpeciesCount?.[selectedSpecies] || 0) +
                (det.returnSpeciesCount?.[selectedSpecies] || 0);
      } else if (viewMode === "observed") {
        count = det.observedSpeciesCount?.[selectedSpecies] || 0;
      }

      data.count += count;
      data.netHours! += netHours;
      data.observerHours! += observerHours;
    });

    // Calculate value based on view mode
    const weeklyData = Array.from(weeklyMap.values()).map(d => {
      let value = d.count;
      if (viewMode === "captured" && d.netHours! > 0) {
        value = d.count / d.netHours!;
      } else if (viewMode === "observed" && d.observerHours! > 0) {
        value = d.count / d.observerHours!;
      }
      return { ...d, value };
    });

    // Get all years from DET data to ensure consistent axis across view modes
    const allDETYears = new Set<number>();
    Object.keys(DETsMap).forEach(dateStr => {
      const year = new Date(dateStr).getFullYear();
      allDETYears.add(year);
    });
    const minYear = Math.min(...Array.from(allDETYears), 2002);
    const maxYear = Math.max(...Array.from(allDETYears));

    // Create complete year range from 2002 to max year
    const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
    const maxCellSize = 20;
    const minCellSize = 10;
    const cellGap = 3;
    const rowGap = 2;
    const height = years.length * (maxCellSize + rowGap);

    if (weeklyData.length === 0) return;

    // Size scale based on hours - anything above median is full size
    const hours = weeklyData.map(d =>
      viewMode === "captured" ? (d.netHours || 0) :
      viewMode === "observed" ? (d.observerHours || 0) :
      1 // DET mode - constant size
    ).filter(h => h > 0).sort((a, b) => a - b);

    const minHours = d3.min(hours) || 0;
    const medianHours = d3.quantile(hours, 0.50) || d3.max(hours) || 1;

    const sizeScale = d3.scaleLinear()
      .domain([minHours, medianHours])
      .range([minCellSize, maxCellSize])
      .clamp(true);

    const getSize = (d: any) => {
      if (viewMode === "det") return maxCellSize;
      const hours = viewMode === "captured" ? (d.netHours || 0) : (d.observerHours || 0);
      return hours > 0 ? sizeScale(hours) : minCellSize;
    };

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top + 20})`);

    // Title
    const speciesInfo = SPECIES_MAP[selectedSpecies];
    const commonName = speciesInfo?.speciesDescriptionMBO || selectedSpecies;
    const frenchName = speciesInfo?.speciesFrench || "";
    const startYear = years[0];
    const endYear = years[years.length - 1];
    const totalEvents = weeklyData.reduce((sum, d) => sum + d.count, 0);

    const viewModeLabel = viewMode === "det" ? "DET count" :
                         viewMode === "captured" ? "Capture rate (birds per net-hour)" :
                         "Observation rate (birds per observer-hour)";

    const sizeNote = viewMode === "det" ? "" :
                     viewMode === "captured" ? "with square size representing net-hours" :
                     "with square size representing observer-hours";

    // First line - main title
    svg.append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "600")
      .text(`${viewModeLabel} of ${commonName} (${frenchName}) from ${startYear} to ${endYear}`);

    // Second line - metadata
    const secondLineText = viewMode === "det"
      ? `(n=${totalEvents}, daily data grouped weekly)`
      : `(n=${totalEvents}, daily data grouped weekly) ${sizeNote}`;

    svg.append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 43)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text(secondLineText);

    // Scales - add spacing between weeks
    const xPadding = maxCellSize;
    const xScale = d3.scaleLinear()
      .domain([0, 54])
      .range([xPadding, width - xPadding])
      .clamp(false);

    const yScale = d3.scaleBand()
      .domain(years.map(String))
      .range([0, height])
      .padding(0.1);

    // Color scale - cap at 95th percentile to prevent outliers from washing out colors
    const values = weeklyData.map(d => d.value).filter(v => v > 0).sort((a, b) => a - b);
    const minValue = d3.min(values) || 0;
    const maxValue = d3.quantile(values, 0.95) || d3.max(values) || 1;

    // Use square root scale for better mid-range visibility
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
      .domain([Math.sqrt(minValue), Math.sqrt(maxValue)])
      .clamp(true);

    const getColor = (value: number) => value > 0 ? colorScale(Math.sqrt(value)) : "#f0f0f0";

    // Draw cells with variable size
    g.selectAll("rect")
      .data(weeklyData)
      .enter()
      .append("rect")
      .attr("x", d => {
        const size = getSize(d);
        return xScale(d.week) - size / 2;
      })
      .attr("y", d => {
        const size = getSize(d);
        return (yScale(String(d.year)) || 0) + (yScale.bandwidth() - size) / 2;
      })
      .attr("width", d => getSize(d) - cellGap)
      .attr("height", d => getSize(d) - cellGap)
      .attr("fill", d => getColor(d.value))
      .style("cursor", "pointer")
      .on("click", function(event, d) {
        let tooltip = d3.select("#heatmap-tooltip");
        if (tooltip.empty()) {
          tooltip = d3.select("body").append("div")
            .attr("id", "heatmap-tooltip")
            .style("position", "absolute")
            .style("background", "white")
            .style("border", "1px solid #ccc")
            .style("border-radius", "8px")
            .style("padding", "12px")
            .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
            .style("font-size", "13px")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .style("opacity", "0") as any;
        }

        const tooltipContent = viewMode === "det"
          ? `<div style="font-weight: 600; margin-bottom: 6px;">Week ${d.week}, ${d.year}</div>
             <div style="font-weight: 600; color: #000000; font-size: 16px;">DET Count: ${d.count}</div>`
          : viewMode === "captured"
          ? `<div style="font-weight: 600; margin-bottom: 6px;">Week ${d.week}, ${d.year}</div>
             <div style="color: #666; margin-bottom: 4px;">Captured: ${d.count}</div>
             <div style="color: #666; margin-bottom: 4px;">Net Hours: ${d.netHours?.toFixed(2)}</div>
             <div style="font-weight: 600; color: #000000;">Rate: ${d.value.toFixed(3)} birds/nh</div>`
          : `<div style="font-weight: 600; margin-bottom: 6px;">Week ${d.week}, ${d.year}</div>
             <div style="color: #666; margin-bottom: 4px;">Observed: ${d.count}</div>
             <div style="color: #666; margin-bottom: 4px;">Observer Hours: ${d.observerHours?.toFixed(2)}</div>
             <div style="font-weight: 600; color: #000000;">Rate: ${d.value.toFixed(3)} birds/oh</div>`;

        tooltip.html(tooltipContent)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 30}px`)
          .style("opacity", "1");
      })
      .on("mouseout", () => {
        d3.select("#heatmap-tooltip").style("opacity", 0);
      });

    // X-axis - months
    const monthWeeks = [1, 5, 9, 14, 18, 23, 27, 32, 36, 40, 45, 49];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
        .tickValues(monthWeeks)
        .tickFormat((_d, i) => monthNames[i]))
      .selectAll("text")
      .style("font-size", "12px");

    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 50)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .text("Month of Year");

    // Y-axis
    g.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("font-size", "12px");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .text("Year");

    // Legend with smooth gradient
    const legendHeight = Math.min(height, 180);
    const legendWidth = 25;
    const legend = g.append("g")
      .attr("transform", `translate(${width + 35}, 20)`);

    const legendLabel = viewMode === "det" ? "Count" : "Rate";

    legend.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -15)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text(legendLabel);

    // Create smooth gradient
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "legend-gradient")
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

    // Add 20 color stops for smooth gradient
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const sqrtValue = Math.sqrt(minValue) + t * (Math.sqrt(maxValue) - Math.sqrt(minValue));
      gradient.append("stop")
        .attr("offset", `${i * 5}%`)
        .attr("stop-color", colorScale(sqrtValue));
    }

    legend.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("rx", 3)
      .style("fill", "url(#legend-gradient)")
      .style("stroke", "#ccc")
      .style("stroke-width", 0.5);

    // Legend scale with actual values (not sqrt)
    const legendScale = d3.scaleLinear()
      .domain([minValue, maxValue])
      .range([legendHeight, 0]);

    const tickFormat = viewMode === "det" ? d3.format(".0f") : d3.format(".2f");

    legend.append("g")
      .attr("transform", `translate(${legendWidth + 5}, 0)`)
      .call(d3.axisRight(legendScale)
        .ticks(5)
        .tickFormat(tickFormat))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "11px")
      .style("font-weight", "500");

    // Size legend - only show for captured and observed modes
    if (viewMode !== "det") {
      const sizeLegendY = 20 + legendHeight + 60;
      const sizeLegend = g.append("g")
        .attr("transform", `translate(${width + 35}, ${sizeLegendY})`);

      sizeLegend.append("text")
        .attr("x", 0)
        .attr("y", -20)
        .style("font-size", "11px")
        .style("font-weight", "600")
        .text(viewMode === "captured" ? "Net Hours" : "Obs Hours");

      sizeLegend.append("text")
        .attr("x", 0)
        .attr("y", -5)
        .style("font-size", "9px")
        .style("fill", "#666")
        .text("(square size)");

      // Draw size examples
      const sizeExamples = [
        { label: "Low (<50%)", size: minCellSize - cellGap },
        { label: "Med (50%)", size: ((minCellSize + maxCellSize) / 2) - cellGap },
        { label: "High (>50%)", size: maxCellSize - cellGap }
      ];

      sizeExamples.forEach((ex, i) => {
        const yPos = i * 30;

        sizeLegend.append("rect")
          .attr("x", 0)
          .attr("y", yPos)
          .attr("width", ex.size)
          .attr("height", ex.size)
          .attr("fill", "#666");

        sizeLegend.append("text")
          .attr("x", maxCellSize + 8)
          .attr("y", yPos + ex.size / 2 + 4)
          .style("font-size", "10px")
          .style("font-weight", "500")
          .text(ex.label);
      });
    }

  }, [selectedSpecies, viewMode, DETsMap]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-sm font-semibold">View Mode (← → arrows)</label>
          <div className="flex flex-wrap gap-2">
            {(["det", "captured", "observed"] as ViewMode[]).map((mode) => (
              <Chip
                key={mode}
                color={viewMode === mode ? "primary" : "default"}
                variant={viewMode === mode ? "solid" : "flat"}
                onClick={() => setViewMode(mode)}
                className="cursor-pointer"
              >
                {mode === "det" ? "DET Count" :
                 mode === "captured" ? "Captured (Rate/NH)" :
                 "Observed (Rate/OH)"}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-3" ref={autocompleteRef}>
          <label className="text-sm font-semibold">Species (↑ ↓ arrows)</label>
          <Select
            placeholder="Select species..."
            selectedKeys={selectedSpecies ? [selectedSpecies] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              if (selected) setSelectedSpecies(selected);
            }}
            size="md"
            variant="bordered"
          >
            {allSpecies.map(({ species, count }) => {
              const speciesInfo = SPECIES_MAP[species];
              const label = `${speciesInfo?.speciesDescriptionMBO || species} (${species}) - ${count} records`;
              return (
                <SelectItem key={species}>
                  {label}
                </SelectItem>
              );
            })}
          </Select>
        </div>
      </div>

      {selectedSpecies ? (
        <div ref={containerRef} className="w-full bg-white border border-default-200 rounded-xl p-6 shadow-sm">
          <svg ref={svgRef}></svg>
        </div>
      ) : (
        <div className="w-full h-64 bg-content1 border border-dashed border-default-300 rounded-xl flex items-center justify-center">
          <p className="text-default-400">Select a species to view the heatmap</p>
        </div>
      )}
    </div>
  );
}
