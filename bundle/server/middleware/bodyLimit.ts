import express, { type RequestHandler } from 'express';

/** Public API bodies are tiny forms; anything bigger gets a 413. (Any upload route sets its own limit.) */
export const BODY_LIMIT = '100kb';

/**
 * Routes that take a photo or screenshot in their body. They carry their own, larger body limit, so the small
 * global one must stand aside for them (it runs first, and would turn away a 200 KB photo before the route saw it).
 */
export const UPLOAD_PATHS = ['/api/photo/read', '/api/offers/audit'];

const unlessUpload = (parser: RequestHandler): RequestHandler => (req, res, next) =>
  UPLOAD_PATHS.includes(req.path) ? next() : parser(req, res, next);

export const bodyParsers = () => [
  unlessUpload(express.json({ limit: BODY_LIMIT })),
  unlessUpload(express.urlencoded({ extended: false, limit: BODY_LIMIT })),
];
