import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const matches = sqliteTable('matches', {
  id: text('id').primaryKey(),
  whiteId: text('white_id'),
  blackId: text('black_id'),
  whiteName: text('white_name'),
  blackName: text('black_name'),
  timeControl: text('time_control'),
  status: text('status').default('active'), // 'active', 'finished'
  result: text('result'), // '1-0', '0-1', '1/2-1/2'
  reason: text('reason'), // 'checkmate', 'repetition', 'resignation', 'agreement'
  pgn: text('pgn'), // Portable Game Notation
  fen: text('fen').notNull().default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const moves = sqliteTable('moves', {
  id: text('id').primaryKey(),
  matchId: text('match_id').notNull().references(() => matches.id),
  uci: text('uci').notNull(),
  moveNumber: integer('move_number').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
