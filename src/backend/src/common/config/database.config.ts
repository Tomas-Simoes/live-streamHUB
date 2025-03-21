export default () => ({
    database: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'user',
        password: process.env.DB_PASSWORD || 'pwd',
        options: process.env.DB_OPTIONS || 'options',
        port: parseInt(process.env.DB_PORT) || 5432,
    }
})