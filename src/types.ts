export const ENDPOINTS_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;

export type EndpointMethod = (typeof ENDPOINTS_METHODS)[number];

export type FigmaEndpoint = {
  method: EndpointMethod;
  url: string;
  response?: string;
};
