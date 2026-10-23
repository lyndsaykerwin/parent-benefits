import express from 'express';

/** Public API bodies are tiny forms; anything bigger gets a 413. (Any future upload route sets its own limit.) */
export const BODY_LIMIT = '100kb';
export const bodyParsers = () => [
  express.json({ limit: BODY_LIMIT }),
  express.urlencoded({ extended: false, limit: BODY_LIMIT }),
];
