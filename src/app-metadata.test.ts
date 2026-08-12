/// <reference types="node" />

import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('app metadata', () => {
  it('declares the dedicated PNG favicon', async () => {
    const html = await readFile('index.html', 'utf8');
    const document = new DOMParser().parseFromString(html, 'text/html');
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    expect(favicon?.getAttribute('type')).toBe('image/png');
    expect(favicon?.getAttribute('href')).toBe('/favicon.png');
  });

  it('ships a 512 pixel square PNG favicon', async () => {
    const favicon = await readFile('public/favicon.png');

    expect([...favicon.subarray(0, 8)]).toEqual(pngSignature);
    expect(favicon.readUInt32BE(16)).toBe(512);
    expect(favicon.readUInt32BE(20)).toBe(512);
  });
});
