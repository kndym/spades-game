# Spades Game Website

A browser-based Spades card game with AI opponents.

## Features

- Play Spades against 3 AI bots
- Heuristic-based MCTS for intelligent bot play
- Modern, responsive UI
- All computation runs client-side (no server required)
- Free hosting on Vercel

## Current Status

The bots use heuristic-based decision making which plays reasonably well.
Neural network inference (ONNX) is not currently enabled due to compatibility
issues with Next.js static builds.

## Prerequisites

- Node.js 20+ (required for Next.js and dependencies)
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Navigate to http://localhost:3000

## Deployment to Vercel

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/spades-website.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Click "Deploy"

3. **Your site will be live at:**
   `https://your-project-name.vercel.app`

## Project Structure

```
spades-website/
├── public/
│   └── models/           # ONNX model files
├── src/
│   ├── app/              # Next.js app router
│   ├── components/       # React components
│   ├── game/             # Game logic (ported from C++)
│   └── hooks/            # React hooks
├── package.json
└── README.md
```

## Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI Inference:** ONNX Runtime Web
- **Hosting:** Vercel (static export)

## Game Rules

- 4 players, 2 teams (You + Partner vs West + East)
- Each player bids how many tricks they'll win
- Follow suit if possible; Spades are trump
- First team to 500 points wins
- Going under bid: -10× bid
- Making bid: +10× bid + overtricks
- 10 overtricks (bags): -100 penalty
- Nil bid: +100 if successful, -100 if failed

## License

MIT
