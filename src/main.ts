import "@total-typescript/ts-reset";
import puppeteer from "puppeteer";
import type { ElementHandle } from "puppeteer";
import { ENDPOINTS_METHODS, EndpointMethod, FigmaEndpoint } from "./types";

const FIGMA_DOC_API_URL = "https://www.figma.com/developers/api";

const DEBUG = false;

const endpointsMap = new Map<string, FigmaEndpoint[]>();

async function parseEndpointDoc(
  endpoint: ElementHandle<HTMLDivElement>
): Promise<FigmaEndpoint> {
  const spans = await endpoint.$$("p > span");

  const getElTextContent = (el: ElementHandle) =>
    el.evaluate((el) => el.textContent || "");

  const spanContents = await Promise.all(spans.map(getElTextContent));

  const method = spanContents.find((text) =>
    ENDPOINTS_METHODS.includes(text)
  ) as EndpointMethod;

  const url = spanContents.find((text) => text.startsWith("/")) || "";

  return {
    method,
    url,
  };
}

async function parseFigmaDoc() {
  const browser = await puppeteer.launch({
    headless: DEBUG ? false : "new",
  });
  const page = await browser.newPage();

  await page.goto(FIGMA_DOC_API_URL);

  const endpointsTagEl = await page.$$('div[id$="-endpoints"]');

  if (!endpointsTagEl || endpointsTagEl.length === 0) {
    throw new Error("No endpoints tag found");
  }

  for (const endpointTagEl of endpointsTagEl) {
    const endpointTagId = await endpointTagEl.evaluate((el) => el.id);
    const endpointsEl = await endpointTagEl.$$(
      `#${endpointTagId} div[id$="-endpoint"]`
    );

    if (!endpointsEl || endpointsEl.length === 0) {
      console.error("No endpoints found for tag", endpointTagId);
      continue;
    }

    const endpoints = await Promise.all(
      endpointsEl.map((endpointEl) => parseEndpointDoc(endpointEl))
    );

    endpointsMap.set(endpointTagId, endpoints);
  }

  console.log("Endpoints map", endpointsMap);

  if (!DEBUG) {
    await browser.close();
  }
}

parseFigmaDoc();
