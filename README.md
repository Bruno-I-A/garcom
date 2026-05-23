# ShiftSys Garçom

PWA para garçons de restaurante, criado com React, Vite, Tailwind CSS, React Router DOM e `vite-plugin-pwa`.

## Requisitos

- Node.js 20 ou superior
- npm

## Instalação

```bash
npm install
cp .env.example .env
npm run dev
```

O app usa a variável:

```bash
VITE_API_URL=https://agentes-agente-restaurante.feit1k.easypanel.host
```

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Deploy na Vercel

1. Envie o repositório para GitHub, GitLab ou Bitbucket.
2. Na Vercel, importe o projeto.
3. Configure a variável de ambiente `VITE_API_URL`.
4. Use as configurações padrão:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Faça o deploy.

## PWA

O app inclui manifest, ícones SVG e service worker gerado pelo `vite-plugin-pwa`. Em Android, abra a URL no Chrome e use a opção de instalar o app.
