/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./public/**/*.{html,js}"],
    theme: {
        extend: {
            colors: {
                obsidian: '#050505',
                neonCyan: '#00f3ff',
                hotPink: '#ff003c',
                cyberBlue: '#001b2e'
            },
            fontFamily: {
                cyber: ['Orbitron', 'sans-serif'],
            },
            boxShadow: {
                neon: '0 0 5px #00f3ff, 0 0 20px #00f3ff',
                neonPink: '0 0 5px #ff003c, 0 0 20px #ff003c',
            },
            animation: {
                glitch: 'glitch 1s linear infinite',
                scanline: 'scanline 10s linear infinite',
            },
            keyframes: {
                glitch: {
                    '0%, 100%': { transform: 'translate(0)' },
                    '20%': { transform: 'translate(-2px, 2px)' },
                    '40%': { transform: 'translate(-2px, -2px)' },
                    '60%': { transform: 'translate(2px, 2px)' },
                    '80%': { transform: 'translate(2px, -2px)' },
                },
                scanline: {
                    '0%': { transform: 'translateY(0)' },
                    '100%': { transform: 'translateY(100vh)' }
                }
            }
        },
    },
    plugins: [],
}
