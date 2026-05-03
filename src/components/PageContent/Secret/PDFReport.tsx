import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { useAppStore } from "../../../stores/useAppStore";
import { SPECIES_MAP } from "../../../types/species";

type ViewMode = "captured" | "observed";

interface HeatmapProps {
  speciesCode: string;
  viewMode: ViewMode;
  DETsMap: any;
  globalScale?: { min: number; max: number };
}

function SingleHeatmap({ speciesCode, viewMode, DETsMap, globalScale }: HeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const containerWidth = 800; // Fixed width for PDF
    const margin = { top: 60, right: 150, bottom: 50, left: 60 };
    const width = containerWidth - margin.left - margin.right;

    // Get week of year (1-53)
    const getWeekOfYear = (date: Date): number => {
      const start = new Date(date.getFullYear(), 0, 1);
      const diff = date.getTime() - start.getTime();
      const oneWeek = 1000 * 60 * 60 * 24 * 7;
      return Math.floor(diff / oneWeek) + 1;
    };

    // Build weekly data
    const weeklyMap = new Map<string, {
      year: number;
      week: number;
      count: number;
      netHours?: number;
      observerHours?: number;
    }>();

    Object.entries(DETsMap).forEach(([dateStr, det]: [string, any]) => {
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
      if (viewMode === "captured") {
        count = (det.bandedSpeciesCount?.[speciesCode] || 0) +
                (det.repeatSpeciesCount?.[speciesCode] || 0) +
                (det.returnSpeciesCount?.[speciesCode] || 0);
      } else if (viewMode === "observed") {
        count = det.observedSpeciesCount?.[speciesCode] || 0;
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

    // Get all years from DET data
    const allDETYears = new Set<number>();
    Object.keys(DETsMap).forEach(dateStr => {
      const year = new Date(dateStr).getFullYear();
      allDETYears.add(year);
    });
    const minYear = Math.min(...Array.from(allDETYears), 2002);
    const maxYear = Math.max(...Array.from(allDETYears));

    const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
    const maxCellSize = 16;
    const minCellSize = 8;
    const cellGap = 2;
    const rowGap = 2;
    const height = years.length * (maxCellSize + rowGap);

    if (weeklyData.length === 0) return;

    // Size scale based on hours
    const hours = weeklyData.map(d =>
      viewMode === "captured" ? (d.netHours || 0) : (d.observerHours || 0)
    ).filter(h => h > 0).sort((a, b) => a - b);

    const minHours = d3.min(hours) || 0;
    const medianHours = d3.quantile(hours, 0.50) || d3.max(hours) || 1;

    const sizeScale = d3.scaleLinear()
      .domain([minHours, medianHours])
      .range([minCellSize, maxCellSize])
      .clamp(true);

    const getSize = (d: any) => {
      const hours = viewMode === "captured" ? (d.netHours || 0) : (d.observerHours || 0);
      return hours > 0 ? sizeScale(hours) : minCellSize;
    };

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Title
    const speciesInfo = SPECIES_MAP[speciesCode];
    const commonName = speciesInfo?.speciesDescriptionMBO || speciesCode;
    const frenchName = speciesInfo?.speciesFrench || "";
    const startYear = years[0];
    const endYear = years[years.length - 1];
    const totalEvents = weeklyData.reduce((sum, d) => sum + d.count, 0);

    const viewModeLabel = viewMode === "captured"
      ? "Capture rate (birds per net-hour)"
      : "Observation rate (birds per observer-hour)";

    const sizeNote = viewMode === "captured"
      ? " with square size representing net-hours"
      : " with square size representing observer-hours";

    // Title
    svg.append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .text(`${viewModeLabel} of ${commonName} (${frenchName}) from ${startYear} to ${endYear}`);

    svg.append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#666")
      .text(`(n=${totalEvents}, daily data grouped weekly) ${sizeNote}`);

    // Scales
    const xPadding = maxCellSize;
    const xScale = d3.scaleLinear()
      .domain([0, 54])
      .range([xPadding, width - xPadding])
      .clamp(false);

    const yScale = d3.scaleBand()
      .domain(years.map(String))
      .range([0, height])
      .padding(0.1);

    // Color scale - use global scale if provided for consistency across species
    const minValue = globalScale?.min ?? (d3.min(weeklyData.map(d => d.value).filter(v => v > 0)) || 0);
    const maxValue = globalScale?.max ?? (d3.quantile(weeklyData.map(d => d.value).filter(v => v > 0).sort((a, b) => a - b), 0.95) || d3.max(weeklyData.map(d => d.value).filter(v => v > 0)) || 1);

    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
      .domain([Math.sqrt(minValue), Math.sqrt(maxValue)])
      .clamp(true);

    const getColor = (value: number) => value > 0 ? colorScale(Math.sqrt(value)) : "#f0f0f0";

    // Draw cells
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
      .attr("fill", d => getColor(d.value));

    // X-axis
    const monthWeeks = [1, 5, 9, 14, 18, 23, 27, 32, 36, 40, 45, 49];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
        .tickValues(monthWeeks)
        .tickFormat((_d, i) => monthNames[i]))
      .selectAll("text")
      .style("font-size", "10px");

    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text("Month of Year");

    // Y-axis
    g.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("font-size", "10px");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text("Year");

    // Legend
    const legendHeight = Math.min(height, 150);
    const legendWidth = 20;
    const legend = g.append("g")
      .attr("transform", `translate(${width + 25}, 10)`);

    legend.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .text("Rate");

    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", `legend-gradient-${speciesCode}-${viewMode}`)
      .attr("x1", "0%")
      .attr("y1", "100%")
      .attr("x2", "0%")
      .attr("y2", "0%");

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
      .style("fill", `url(#legend-gradient-${speciesCode}-${viewMode})`)
      .style("stroke", "#ccc")
      .style("stroke-width", 0.5);

    const legendScale = d3.scaleLinear()
      .domain([minValue, maxValue])
      .range([legendHeight, 0]);

    const tickFormat = d3.format(".2f");

    legend.append("g")
      .attr("transform", `translate(${legendWidth + 3}, 0)`)
      .call(d3.axisRight(legendScale)
        .ticks(5)
        .tickFormat(tickFormat))
      .call(g => g.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "9px");

  }, [speciesCode, viewMode, DETsMap, globalScale]);

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default function PDFReport() {
  const DETsMap = useAppStore((s) => s.DETsMap);

  // Get top 50 species by total DET count
  const topSpecies = useMemo(() => {
    const speciesCounts = new Map<string, number>();
    Object.values(DETsMap).forEach((det: any) => {
      Object.entries(det.DETSpeciesCount || {}).forEach(([species, count]) => {
        speciesCounts.set(species, (speciesCounts.get(species) || 0) + (count as number));
      });
    });
    return Array.from(speciesCounts, ([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)
      .map(s => s.species);
  }, [DETsMap]);

  // Calculate global scales for consistent coloring across all species
  const globalScales = useMemo(() => {
    const capturedValues: number[] = [];
    const observedValues: number[] = [];

    const getWeekOfYear = (date: Date): number => {
      const start = new Date(date.getFullYear(), 0, 1);
      const diff = date.getTime() - start.getTime();
      const oneWeek = 1000 * 60 * 60 * 24 * 7;
      return Math.floor(diff / oneWeek) + 1;
    };

    topSpecies.forEach(species => {
      const weeklyMap = new Map<string, { count: number; netHours: number; observerHours: number }>();

      Object.entries(DETsMap).forEach(([dateStr, det]: [string, any]) => {
        const netHours = parseFloat(det?.netHours?.total || "0");
        const observerHours = det?.observerHours?.total || 0;
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const week = getWeekOfYear(date);
        const key = `${year}-${week}`;

        if (!weeklyMap.has(key)) {
          weeklyMap.set(key, { count: 0, netHours: 0, observerHours: 0 });
        }

        const data = weeklyMap.get(key)!;

        // Captured count
        const capturedCount = (det.bandedSpeciesCount?.[species] || 0) +
                              (det.repeatSpeciesCount?.[species] || 0) +
                              (det.returnSpeciesCount?.[species] || 0);
        // Observed count
        const observedCount = det.observedSpeciesCount?.[species] || 0;

        data.count += capturedCount;
        data.netHours += netHours;
        data.observerHours += observerHours;

        // Calculate rates
        if (netHours > 0 && capturedCount > 0) {
          capturedValues.push(capturedCount / netHours);
        }
        if (observerHours > 0 && observedCount > 0) {
          observedValues.push(observedCount / observerHours);
        }
      });
    });

    // Calculate 95th percentile for global scales
    const capturedSorted = capturedValues.sort((a, b) => a - b);
    const observedSorted = observedValues.sort((a, b) => a - b);

    return {
      captured: {
        min: d3.min(capturedValues) || 0,
        max: d3.quantile(capturedSorted, 0.95) || d3.max(capturedValues) || 1,
      },
      observed: {
        min: d3.min(observedValues) || 0,
        max: d3.quantile(observedSorted, 0.95) || d3.max(observedValues) || 1,
      },
    };
  }, [DETsMap, topSpecies]);

  useEffect(() => {
    // Auto-print when page loads
    const timer = setTimeout(() => {
      window.print();
    }, 2000); // Wait 2 seconds for all charts to render

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="pdf-report">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0.5cm;
          }

          .page-break {
            page-break-after: always;
            page-break-inside: avoid;
          }

          .heatmap-container {
            page-break-inside: avoid;
            margin-bottom: 20px;
          }

          body {
            margin: 0;
            padding: 0;
          }
        }

        @media screen {
          .pdf-report {
            max-width: 21cm;
            margin: 0 auto;
            background: white;
            padding: 1cm;
          }

          .page-break {
            border-bottom: 2px dashed #ccc;
            margin: 2cm 0;
            padding-bottom: 2cm;
          }
        }

        .heatmap-container {
          margin-bottom: 1cm;
        }
      `}</style>

      {topSpecies.map((species, index) => (
        <div key={species} className={index < topSpecies.length - 1 ? "page-break" : ""}>
          <div className="heatmap-container">
            <SingleHeatmap
              speciesCode={species}
              viewMode="captured"
              DETsMap={DETsMap}
              globalScale={globalScales.captured}
            />
          </div>
          <div className="heatmap-container">
            <SingleHeatmap
              speciesCode={species}
              viewMode="observed"
              DETsMap={DETsMap}
              globalScale={globalScales.observed}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
