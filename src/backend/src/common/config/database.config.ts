export default () => ({
  database: {
    url:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER || 'user'}:${process.env.DB_PASSWORD || 'pwd'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'live_stream_hub'}?schema=${process.env.DB_SCHEMA || 'public'}`,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'pwd',
    name: process.env.DB_NAME || 'live_stream_hub',
    schema: process.env.DB_SCHEMA || 'public',
    port: parseInt(process.env.DB_PORT || '5432', 10) || 5432,
  },
});
