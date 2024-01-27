import "@total-typescript/ts-reset";
import puppeteer from "puppeteer";
import type { ElementHandle } from "puppeteer";
import { ENDPOINTS_METHODS, EndpointMethod, FigmaEndpoint } from "./types";

const FIGMA_DOC_API_URL = "https://www.figma.com/developers/api";

const DEBUG = false;

const endpointsMap = new Map<string, FigmaEndpoint[]>();
const interfaces = new Map<string, string>();

function urlToInterfaceName({
  url,
  method,
}: Pick<FigmaEndpoint, "url" | "method">) {
  const methodName =
    method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();

  const formattedUrl = url
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        return "Param";
      } else {
        return segment
          .split("_")
          .map(
            (subSegment) =>
              subSegment.charAt(0).toUpperCase() +
              subSegment.slice(1).toLowerCase()
          )
          .join("");
      }
    })
    .join("");

  return methodName + formattedUrl;
}

async function parseEndpointUrl(
  endpoint: ElementHandle<HTMLDivElement>
): Promise<Pick<FigmaEndpoint, "method" | "url">> {
  const spans = await endpoint.$$("p > span");

  const spanContents = await Promise.all(
    spans.map((el: ElementHandle) => el.evaluate((el) => el.textContent || ""))
  );

  const method = spanContents.find((text) =>
    ENDPOINTS_METHODS.includes(text)
  ) as EndpointMethod;

  const url = spanContents.find((text) => text.startsWith("/")) || "";

  return {
    method,
    url,
  };
}

async function parseEndpointResponse(endpoint: ElementHandle<HTMLDivElement>) {
  const responseEl = await endpoint.$('div[class*="developer_docs--returns"]');
  const responseContent = await responseEl?.evaluate((el) => el.textContent);

  return responseContent || undefined;
}

async function parseEndpointDoc(
  endpoint: ElementHandle<HTMLDivElement>
): Promise<FigmaEndpoint> {
  const endpointUrlAndMethod = await parseEndpointUrl(endpoint);
  const responseContent = await parseEndpointResponse(endpoint);

  const responseInterfaceName = urlToInterfaceName(endpointUrlAndMethod);

  const hasResponse = responseContent && responseContent.startsWith("{");

  // TODO: if referencing an existing interface: generate all existing interface before
  if (hasResponse) {
    interfaces.set(responseInterfaceName, responseContent);
  }

  return {
    ...endpointUrlAndMethod,
    response: hasResponse ? responseInterfaceName : undefined,
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
