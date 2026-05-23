/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                agriGreen: {
                    50: "#f0f7f4",
                    100: "#d8ebe3",
                    200: "#b4d8cb",
                    500: "#2d6a4f",
                    600: "#285f47",
                    700: "#235440",
                    800: "#1b4332",
                    900: "#122b21",
                    DEFAULT: "#2D6A4F",
                    light: "#74C69D",
                    dark: "#1B4332",
                },
                agriGold: "#D4A017",
                agriBrown: "#6B4226",
                agriCream: "#F5F0E8",
                agriRed: "#C0392B",
            },
            fontFamily: {
                merriweather: ["Merriweather", "serif"],
                heading: ["Merriweather", "serif"],
                body: ["Nunito", "sans-serif"],
                mono: ["Roboto Mono", "monospace"],
                nunito: ["Nunito", "sans-serif"],
            },
        },
    },
    plugins: [],
};
