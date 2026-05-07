import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardBody, Button } from "@heroui/react";
import { SPECIES_MAP } from "../../../types/species";

export interface BoxStats {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export type MeasurementMap = Record<string, Record<string, BoxStats>>;

interface SpeciesMeasurementBoxPlotProps {
  /** species -> year -> box-plot stats */
  dataMap: MeasurementMap;
  selectedSpecies: string;
  yearRange: { min: number; max: number };
  /** Short measurement name, e.g. "Wing chord" or "Weight". */
  measurementLabel: string;
  /** Unit string appended to axis/tooltip values, e.g. "mm" or "g". */
  unit: string;
  /** Suffix used in exported JPEG filename, e.g. "wing" or "weight". */
  filenameSuffix: string;
  /** Decimal places used when formatting tooltip/axis values. */
  precision?: number;
}

export default function SpeciesMeasurementBoxPlot({
  dataMap,
  selectedSpecies,
  yearRange,
  measurementLabel,
  unit,
  filenameSuffix,
  precision = 1,
}: SpeciesMeasurementBoxPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const speciesStats = dataMap[selectedSpecies];

  const exportChart = async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    try {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const scale = 4;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          ctx.scale(scale, scale);
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, img.width, img.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (!blob) return;
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${selectedSpecies}_${filenameSuffix}_boxplot.jpg`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              resolve();
            },
            "image/jpeg",
            0.98
          );
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!svgRef.current || !speciesStats) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const fixedWidth = 1200;
    const margin = { top: 80, right: 180, bottom: 70, left: 80 };
    const width = fixedWidth - margin.left - margin.right;

    const years = Array.from(
      { length: yearRange.max - yearRange.min + 1 },
      (_, i) => yearRange.min + i
    );

    const rowHeight = 28;
    const height = years.length * rowHeight;

    let xMin = Infinity;
    let xMax = -Infinity;
    let totalN = 0;
    for (const year of years) {
      const s = speciesStats[String(year)];
      if (!s) continue;
      if (s.min < xMin) xMin = s.min;
      if (s.max > xMax) xMax = s.max;
      totalN += s.n;
    }
    if (!isFinite(xMin) || !isFinite(xMax) || totalN === 0) return;

    const span = Math.max(xMax - xMin, 1);
    const pad = span * 0.05;
    xMin -= pad;
    xMax += pad;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top + 20})`);

    const speciesInfo = SPECIES_MAP[selectedSpecies];
    const commonName = speciesInfo?.speciesDescriptionMBO || selectedSpecies;
    const frenchName = speciesInfo?.speciesFrench || "";

    svg
      .append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "600")
      .text(`${measurementLabel} of ${commonName} (${frenchName}) by year, ${yearRange.min}–${yearRange.max}`);

    svg
      .append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 43)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text(`(n=${totalN}; box = Q1–Q3, line = median, whiskers = 1.5·IQR clamped to data)`);

    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, width]);

    const yScale = d3
      .scaleBand<string>()
      .domain(years.map(String))
      .range([0, height])
      .padding(0.25);

    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-height)
          .tickFormat(() => "")
      )
      .call((gg) => gg.select(".domain").remove())
      .call((gg) => gg.selectAll(".tick line").style("stroke", "#e0e0e0").style("stroke-dasharray", "2,2"));

    const boxHeight = yScale.bandwidth();
    const tooltipId = `boxplot-tooltip-${filenameSuffix}`;
    const ensureTooltip = () => {
      let t = d3.select<HTMLDivElement, unknown>(`#${tooltipId}`);
      if (t.empty()) {
        t = d3
          .select("body")
          .append("div")
          .attr("id", tooltipId)
          .style("position", "absolute")
          .style("background", "white")
          .style("border", "1px solid #ccc")
          .style("border-radius", "8px")
          .style("padding", "12px")
          .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
          .style("font-size", "13px")
          .style("pointer-events", "none")
          .style("z-index", "1000")
          .style("opacity", "0");
      }
      return t;
    };

    const fmt = (v: number) => v.toFixed(precision);

    for (const year of years) {
      const s = speciesStats[String(year)];
      const yPos = yScale(String(year)) || 0;
      if (!s) continue;

      const fill = "#6aa5d1";
      const stroke = "#1f4f7a";

      g.append("line")
        .attr("x1", xScale(s.min))
        .attr("x2", xScale(s.max))
        .attr("y1", yPos + boxHeight / 2)
        .attr("y2", yPos + boxHeight / 2)
        .attr("stroke", stroke)
        .attr("stroke-width", 1);

      const capHeight = boxHeight * 0.4;
      g.append("line")
        .attr("x1", xScale(s.min))
        .attr("x2", xScale(s.min))
        .attr("y1", yPos + boxHeight / 2 - capHeight / 2)
        .attr("y2", yPos + boxHeight / 2 + capHeight / 2)
        .attr("stroke", stroke)
        .attr("stroke-width", 1);
      g.append("line")
        .attr("x1", xScale(s.max))
        .attr("x2", xScale(s.max))
        .attr("y1", yPos + boxHeight / 2 - capHeight / 2)
        .attr("y2", yPos + boxHeight / 2 + capHeight / 2)
        .attr("stroke", stroke)
        .attr("stroke-width", 1);

      const boxX = xScale(s.q1);
      const boxW = Math.max(xScale(s.q3) - xScale(s.q1), 1);
      g.append("rect")
        .attr("x", boxX)
        .attr("y", yPos)
        .attr("width", boxW)
        .attr("height", boxHeight)
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("click", (event) => {
          const t = ensureTooltip();
          t.html(
            `<div style="font-weight: 600; margin-bottom: 6px;">${year} (n=${s.n})</div>
             <div>min (whisker): ${fmt(s.min)} ${unit}</div>
             <div>Q1: ${fmt(s.q1)} ${unit}</div>
             <div style="font-weight: 600; color: #000;">median: ${fmt(s.median)} ${unit}</div>
             <div>Q3: ${fmt(s.q3)} ${unit}</div>
             <div>max (whisker): ${fmt(s.max)} ${unit}</div>`
          )
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 30}px`)
            .style("opacity", "1");
        })
        .on("mouseout", () => {
          d3.select(`#${tooltipId}`).style("opacity", 0);
        });

      g.append("line")
        .attr("x1", xScale(s.median))
        .attr("x2", xScale(s.median))
        .attr("y1", yPos)
        .attr("y2", yPos + boxHeight)
        .attr("stroke", "#0a1f33")
        .attr("stroke-width", 2);
    }

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat((d) => `${Number(d).toFixed(0)}`))
      .selectAll("text")
      .style("font-size", "12px");

    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 50)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .text(`${measurementLabel} (${unit})`);

    g.append("g").call(d3.axisLeft(yScale)).selectAll("text").style("font-size", "12px");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .text("Year");

    const nLabels = g.append("g").attr("transform", `translate(${width + 10}, 0)`);
    nLabels
      .append("text")
      .attr("x", 0)
      .attr("y", -8)
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", "#666")
      .text("n");
    for (const year of years) {
      const s = speciesStats[String(year)];
      if (!s) continue;
      const yPos = (yScale(String(year)) || 0) + boxHeight / 2 + 4;
      nLabels
        .append("text")
        .attr("x", 0)
        .attr("y", yPos)
        .style("font-size", "11px")
        .style("fill", "#666")
        .text(s.n);
    }
  }, [speciesStats, selectedSpecies, yearRange.min, yearRange.max, measurementLabel, unit, filenameSuffix, precision]);

  if (!speciesStats) {
    return (
      <Card className="shadow-sm">
        <CardBody className="flex items-center justify-center h-48 md:h-64">
          <p className="text-sm md:text-base text-default-400">
            No {measurementLabel.toLowerCase()} data available for this species
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardBody className="p-4 md:p-6">
        <div className="w-full">
          <svg ref={svgRef}></svg>
        </div>
        <div className="flex justify-center md:justify-end mt-6 md:mt-12">
          <Button
            color="default"
            variant="light"
            onPress={exportChart}
            isLoading={isExporting}
            size="sm"
            className="md:size-md"
          >
            {isExporting ? "Exporting..." : "Export Chart as JPEG"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
