import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { daySchema } from './schema.ts';

// Only top-level files: a future content/days/it/ folder will be its own collection.
const days = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/days' }),
  schema: daySchema,
});

export const collections = { days };
