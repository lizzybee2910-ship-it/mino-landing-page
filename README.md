# mino-landing-page

  This repository contains the Mino landing page, packaged as a pnpm monorepo. The
  deployable artifact is **`artifacts/mino`** — a Vite + React static site. The
  other artifacts in `artifacts/` (API server, mockup sandbox) are part of the
  broader project but are **not** what Vercel builds.

  ## ⚠️ Before importing into Vercel: upload the missing files

  The initial commit was made through a size-limited API, so **68 files**
  (mostly large binary brand assets, logos, fonts, photos, and a GitHub Actions
  workflow file) were **not pushed automatically**. The Vercel build will fail
  until the ones imported by the Mino site are present.

  The simplest way to add them is GitHub's drag-and-drop uploader:

  1. Open this repo on GitHub: https://github.com/lizzybee2910-ship-it/mino-landing-page
  2. For each folder listed below, navigate to it (or click **Add file → Upload files**
     from the repo root)
  3. Drag the matching local files from this project into the GitHub upload area
  4. Click **Commit changes** (commit straight to `main`)

  You can do this in batches — GitHub's web uploader accepts multiple files at
  once and creates the directories for you. Files that are missing:
  
**`.agents/`** (1 file):

- `.agents/skills/ui-ux-pro-max/data/google-fonts.csv`

**`.github/workflows/`** (1 file):

- `.github/workflows/test.yml`

**`artifacts/api-server/`** (4 files):

- `artifacts/api-server/assets/fonts/NotoSans-Bold.ttf`
- `artifacts/api-server/assets/fonts/NotoSans-Italic.ttf`
- `artifacts/api-server/assets/fonts/NotoSans-Regular.ttf`
- `artifacts/api-server/assets/fonts/NotoSansSC-Regular.ttf`

**`artifacts/mino/public/`** (4 files):

- `artifacts/mino/public/_brand-reference.html`
- `artifacts/mino/public/feature1.png`
- `artifacts/mino/public/feature2.png`
- `artifacts/mino/public/hero.png`

**`attached_assets/`** (47 files):

- `attached_assets/8A19F97B-1B47-41ED-94F6-D90DB1152479_1777337529831.PNG`
- `attached_assets/8A19F97B-1B47-41ED-94F6-D90DB1152479_1777397369066.PNG`
- `attached_assets/Gemini_Generated_Image_2rm7q02rm7q02rm7_1777229954110.png`
- `attached_assets/Gemini_Generated_Image_2rm7q02rm7q02rm7_1777237606776.png`
- `attached_assets/Gemini_Generated_Image_4g4ywi4g4ywi4g4y_1777237606776.png`
- `attached_assets/Gemini_Generated_Image_k838m4k838m4k838_1777229044551.png`
- `attached_assets/Gemini_Generated_Image_k838m4k838m4k838_1777229934691.png`
- `attached_assets/Gemini_Generated_Image_k838m4k838m4k838_1777231083630.png`
- `attached_assets/IMG_9812_1777723176763.HEIC`
- `attached_assets/IMG_9813_1777723176763.HEIC`
- `attached_assets/IMG_9814_1777723176763.HEIC`
- `attached_assets/IMG_9815_1777723353943.HEIC`
- `attached_assets/Image_Animation_To_Video_1777229976503.mp4`
- `attached_assets/Mino_Black_1777222658375.eps`
- `attached_assets/Mino_Brand_Catalog_2026_1777220648024.html`
- `attached_assets/Mino_Brand_Catalog_2026_1777220648025.pdf`
- `attached_assets/Mino_Catalog_1777220648025.pdf`
- `attached_assets/Mino_Compendium_1777226289763.pdf`
- `attached_assets/Mino_MD_B2B_Pitch_1777221113188.pptx`
- `attached_assets/Mino_Marketing__standalone__1777220851697.html`
- `attached_assets/Mino_White_1777250616823.eps`
- `attached_assets/Photo_Nov_24_2025,_3_59_01_PM_(5)_1777305723783.png`
- `attached_assets/Screenshot_2026-04-11_at_1.43.34_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.43.39_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.43.42_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.43.45_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.43.48_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.43.51_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.43.55_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.43.58_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.44.01_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-11_at_1.44.07_PM_1777226244767.png`
- `attached_assets/Screenshot_2026-04-26_at_9.12.08_PM_1777252345646.png`
- `attached_assets/Screenshot_2026-05-01_at_8.56.31_PM_1777683421342.png`
- `attached_assets/mino-01_1777220970583.png`
- `attached_assets/mino-02_1777220970583.png`
- `attached_assets/mino-03_1777220970583.png`
- `attached_assets/mino-04_1777220970583.png`
- `attached_assets/mino-06_1777220970583.png`
- `attached_assets/mino-07_1777220970583.png`
- `attached_assets/mino-09_1777220970583.png`
- `attached_assets/mino-10_1777220970583.png`
- `attached_assets/mino-11_1777220970583.png`
- `attached_assets/mino-12_1777220970583.png`
- `attached_assets/mino_cognitive_clinic_flyer_clean_1777220328683.png`
- `attached_assets/mino_longevity_massive_type_clean_1777220328683.png`
- `attached_assets/mino_product_ad_ghk_cu_serum_clean_1777220328683.pdf`

**`attached_assets/hires/`** (1 file):

- `attached_assets/hires/quote_longevity.png`

**`attached_assets/mino_clean/`** (9 files):

- `attached_assets/mino_clean/02_box_embossed.png`
- `attached_assets/mino_clean/03_box_open_vials.png`
- `attached_assets/mino_clean/04_vials_pair.png`
- `attached_assets/mino_clean/06_bpc157_packaging.png`
- `attached_assets/mino_clean/07_triptych.png`
- `attached_assets/mino_clean/08_pen_injectors.png`
- `attached_assets/mino_clean/09_motsc_box_cartridges.png`
- `attached_assets/mino_clean/10_motsc_pens.png`
- `attached_assets/mino_clean/11_motsc_kit.png`

**`other/`** (1 file):

- `"attached_assets/(mino)_\342\200\224_Marketing_1777220693102.html"`

  > Note: `.github/workflows/test.yml` only uploads cleanly if your GitHub
  > account has the `workflow` permission, which it does by default for repos
  > you own.

  ## Deploying to Vercel

  The repo ships with a `vercel.json` that tells Vercel exactly how to build the
  Mino landing page out of this monorepo. You should not need to change any
  settings in the Vercel UI.

  1. Go to https://vercel.com/new
  2. Click **Import Git Repository** and select `mino-landing-page`
  3. Leave every detected setting as-is — Framework Preset: *Other*; Root
     Directory: `./`; Build Command, Install Command, and Output Directory are
     all picked up from `vercel.json`
  4. Click **Deploy**

  That's it — Vercel will:

  - install the whole pnpm workspace at the repo root
  - build only the `@workspace/mino` package and its workspace dependencies
  - serve the static output from `artifacts/mino/dist/public`

  ### Adding your custom GoDaddy domain

  Once the first deploy succeeds:

  1. In the Vercel dashboard, open your new project
  2. Go to **Settings → Domains**
  3. Click **Add**, type your GoDaddy domain, and follow Vercel's instructions
     for either pointing your domain's nameservers at Vercel or adding the `A` /
     `CNAME` records in GoDaddy's DNS panel

  ## Local development (optional)

  This repo is primarily authored on Replit. If you want to run the landing page
  locally:

  ```bash
  corepack enable
  pnpm install
  PORT=3000 BASE_PATH=/ pnpm --filter @workspace/mino run dev
  ```

  The dev server listens on `http://localhost:3000/`.
  