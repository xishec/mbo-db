import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { BirdEvent } from "../../../types";
import { useAppStore } from "../../../stores/useAppStore";
import { getSpeciesDisplayCode, resolveSpeciesKey } from "../../../types/species";

interface SpeciesBarChartProps {
  data: BirdEvent[];
}

export default function SpeciesBarChart({ data }: SpeciesBarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    const getSpeciesKey = (species: string) => resolveSpeciesKey(species, speciesAliasesMap);
    const getDisplayCode = (species: string) => getSpeciesDisplayCode(species, speciesAliasesMap);

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Count species occurrences
    const speciesCounts = d3.rollup(
      data,
      (v) => v.length,
      (d) => getSpeciesKey(d.species)
    );

    // Convert to array and sort by count (top 20)
    const topSpecies = Array.from(speciesCounts, ([species, count]) => ({
      species,
      count,
    }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Set up dimensions
    const margin = { top: 20, right: 30, bottom: 60, left: 80 };
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3
      .scaleBand()
      .domain(topSpecies.map((d) => d.species))
      .range([0, width])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(topSpecies, (d) => d.count) || 0])
      .nice()
      .range([height, 0]);

    // Add bars
    svg
      .selectAll(".bar")
      .data(topSpecies)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.species) || 0)
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d.count))
      .attr("fill", "#3b82f6")
      .attr("opacity", 0.8)
      .on("mouseover", function () {
        d3.select(this).attr("opacity", 1);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.8);
      });

    // Add count labels on bars
    svg
      .selectAll(".label")
      .data(topSpecies)
      .join("text")
      .attr("class", "label")
      .attr("x", (d) => (x(d.species) || 0) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.count) - 5)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("font-size", "12px")
      .text((d) => d.count);

    // Add X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(getDisplayCode))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end")
      .attr("fill", "currentColor");

    // Add Y axis
    svg.append("g").call(d3.axisLeft(y)).selectAll("text").attr("fill", "currentColor");

    // Style axis lines
    svg.selectAll(".domain, .tick line").attr("stroke", "currentColor");

    // Add Y axis label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - height / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .attr("fill", "currentColor")
      .text("Number of Captures");
  }, [data, speciesAliasesMap]);

  return (
    <div className="w-full overflow-x-auto">
      <svg ref={svgRef}></svg>
    </div>
  );
}
