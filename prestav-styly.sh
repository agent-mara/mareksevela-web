#!/bin/bash
# Přestaví tailwind.css podle index.html.
#
# KDY TO SPUSTIT: pokaždé, když v index.html přibude nová Tailwind třída
# (např. text-3xl, gap-8, bg-emerald-500…). Dokud se styly nepřestaví,
# nová třída na webu nic neudělá.
#
# Spuštění:  bash ~/"Agentic Workflows"/prestav-styly.sh

set -e
ZDROJ="$HOME/Agentic Workflows"
cd "$ZDROJ"

cat > /tmp/tw-vstup.css <<'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;
CSS

cat > /tmp/tw-config.js <<'JS'
module.exports = {
  content: [process.env.HTML_PATH],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: { dark: '#08080f', dark2: '#0d0d1a', dark3: '#11111e', darkcard: '#15152a' },
      keyframes: {
        float:    { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-20px)' } },
        fadeup:   { '0%': { opacity:'0', transform:'translateY(30px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        shimmer:  { '0%': { backgroundPosition: '-200% center' }, '100%': { backgroundPosition: '200% center' } },
        blobmove: { '0%,100%': { borderRadius:'60% 40% 30% 70%/60% 30% 70% 40%' }, '50%': { borderRadius:'30% 60% 70% 40%/50% 60% 30% 60%' } },
      },
      animation: {
        float:    'float 6s ease-in-out infinite',
        fadeup:   'fadeup 0.7s ease forwards',
        shimmer:  'shimmer 3s linear infinite',
        blobmove: 'blobmove 8s ease-in-out infinite',
      }
    }
  }
}
JS

export HTML_PATH="$ZDROJ/index.html"
npx -y tailwindcss@3.4.1 -c /tmp/tw-config.js -i /tmp/tw-vstup.css -o "$ZDROJ/tailwind.css" --minify
cp "$ZDROJ/tailwind.css" "$ZDROJ/web-k-nahrani/tailwind.css"
echo "Hotovo: $(ls -lh "$ZDROJ/tailwind.css" | awk '{print $5}')"
