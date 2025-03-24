export default () => ({
    jwt: {
        secret: process.env.JWT_SECRET || '15345dfb3b267a4c8c8a3617f583b91d0a0906c0677714b5c7c109eb0c25ccdc'
    }
})