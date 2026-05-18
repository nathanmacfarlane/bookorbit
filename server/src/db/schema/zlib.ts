import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const zlibCredentials = pgTable(
  'zlib_credentials',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    remixUserId: varchar('remix_user_id', { length: 100 }).notNull(),
    remixUserKey: text('remix_user_key').notNull(), // encrypted AES-256-GCM
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex('zlib_credentials_user_id_uidx').on(t.userId), index('zlib_credentials_user_id_idx').on(t.userId)],
);

export type ZlibCredential = typeof zlibCredentials.$inferSelect;
export type NewZlibCredential = typeof zlibCredentials.$inferInsert;
