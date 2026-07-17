import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { BirdEvent } from "../../../types";
import { useAppStore } from "../../../stores/useAppStore";
import { getSpeciesDisplayCode, resolveSpeciesKey } from "../../../types/species";

interface BirdEventsByNetHeatmapProps {
  data: BirdEvent[];
}

export default function BirdEventsByNetHeatmap({ data }: BirdEventsByNetHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    const getSpeciesKey = (species: string) => resolveSpeciesKey(species, speciesAliasesMap);
    const getDisplayCode = (species: string) => getSpeciesDisplayCode(species, speciesAliasesMap);

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Get top 15 species and top 15 nets
    const speciesCounts = d3.rollup(
      data,
      (v) => v.length,
      (d) => getSpeciesKey(d.species)
    );
    const topSpecies = Array.from(speciesCounts, ([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((d) => d.species);

    const netCounts = d3.rollup(
      data,
      (v) => v.length,
      (d) => d.net
    );
    const topNets = Array.from(netCounts, ([net, count]) => ({ net, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((d) => d.net);

    // Filter data to top species and nets
    const filteredData = data.filter((d) => topSpecies.includes(getSpeciesKey(d.species)) && topNets.includes(d.net));

    // Create matrix: species x net
    const matrix = d3.rollup(
      filteredData,
      (v) => v.length,
      (d) => getSpeciesKey(d.species),
      (d) => d.net
    );

    // Flatten for D3
    const heatmapData: { species: string; net: string; count: number }[] = [];
    topSpecies.forEach((species) => {
      topNets.forEach((net) => {
        const count = matrix.get(species)?.get(net) || 0;
        heatmapData.push({ species, net, count });
      });
    });

    // Set up dimensions
    const margin = { top: 50, right: 30, bottom: 100, left: 100 };
    const cellSize = 30;
    const width = topNets.length * cellSize;
    const height = topSpecies.length * cellSize;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleBand().domain(topNets).range([0, width]).padding(0.05);

    const yScale = d3.scaleBand().domain(topSpecies).range([0, height]).padding(0.05);

    const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(heatmapData, (d) => d.count) || 0]);

    // Add cells
    svg
      .selectAll(".cell")
      .data(heatmapData)
      .join("rect")
      .attr("class", "cell")
      .attr("x", (d) => xScale(d.net) || 0)
      .attr("y", (d) => yScale(d.species) || 0)
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", (d) => (d.count > 0 ? colorScale(d.count) : "#f0f0f0"))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke", "#000").attr("stroke-width", 2);

        // Show tooltip
        d3.select("body")
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .html(`Species: ${getDisplayCode(d.species)}<br/>Net: ${d.net}<br/>Captures: ${d.count}`)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 10}px`);
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1);
        d3.selectAll(".tooltip").remove();
      });

    // Add text labels for non-zero cells
    svg
      .selectAll(".cell-text")
      .data(heatmapData.filter((d) => d.count > 0))
      .join("text")
      .attr("class", "cell-text")
      .attr("x", (d) => (xScale(d.net) || 0) + xScale.bandwidth() / 2)
      .attr("y", (d) => (yScale(d.species) || 0) + yScale.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", (d) => (d.count > (d3.max(heatmapData, (d) => d.count) || 0) / 2 ? "white" : "black"))
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .text((d) => d.count);

    // Add X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("fill", "currentColor");

    // Add Y axis
    svg.append("g").call(d3.axisLeft(yScale).tickFormat(getDisplayCode)).selectAll("text").attr("fill", "currentColor");

    // Style axis lines
    svg.selectAll(".domain, .tick line").attr("stroke", "currentColor");

    // Add axis labels
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 10)
      .style("text-anchor", "middle")
      .attr("fill", "currentColor")
      .text("Net");

    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .attr("fill", "currentColor")
      .text("Species");
  }, [data, speciesAliasesMap]);

  return (
    <div className="w-full overflow-x-auto">
      <svg ref={svgRef}></svg>
    </div>
  );
}
