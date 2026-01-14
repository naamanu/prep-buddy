# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PrepBuddy is an AI-powered interview preparation platform built with React 19, TypeScript, and Vite. It uses Google's Gemini AI for code analysis, tutoring, and learning module generation. The app has a retro CRT aesthetic.

## Commands

```bash
# Development
npm install              # Install all dependencies (including monorepo packages)
npm run dev              # Start dev server on port 3000

# Building
npm run build            # Build main app for production
npm run build:packages   # Build all monorepo packages (gemini-service, storage)
npm run dev:packages     # Watch mode for monorepo packages

# Preview
npm run preview          # Preview production build
```

## Architecture

### View-based Routing (App.tsx)
The app uses simple state-based routing with four views:
- `landing` → LandingPage (home)
- `coding` → CodingApp (LeetCode-style practice)
- `system-design` → SystemDesignApp (whiteboard design)
- `learning` → LearningApp (custom topic modules)

### Monorepo Structure
Uses npm workspaces with two publishable packages in `packages/`:

**@prepbuddy/gemini-service** - Gemini AI wrapper with methods:
- `analyzeSolution()` - Grade and analyze code
- `generateOfficialSolution()` - Generate solutions
- `chatWithTutor()` / `chatWithSystemDesignTutor()` / `chatWithLearningTutor()` - AI tutoring

**@prepbuddy/storage** - localStorage wrapper for progress tracking

### Service Layer (services/index.ts)
Initializes packages and exports bound methods for backward compatibility. All components import from `services/` rather than packages directly.

### Data Files
- `constants.ts` - 70+ coding problems with solutions, companies, tags
- `referenceData.ts` - Data structure/algorithm reference materials
- `systemDesignData.ts` - System design interview questions

## Key Patterns

- Path alias: `@/` maps to root directory
- All components are functional React.FC with TypeScript
- Tailwind CSS via CDN (configured in index.html)
- PrismJS for syntax highlighting in code editor
- localStorage for offline progress persistence

## Environment Variables

Required in `.env.local`:
```
VITE_GEMINI_API_KEY=<google_gemini_api_key>
```
