# 1. Sistem Mimarisi (`system-architecture.md`)

> **Doğrulama Özeti:** Çalışma alanı kaynak kodu incelenmiştir. Mevcut kod tabanı yalnızca başlangıç düzeyinde bir **Vite + React** web uygulaması iskeleti içermektedir. Electron ana süreci (`Main Process`), `Preload`, `IPC`, `WebContentsView`, harici seçici yapılandırması ve yerel dosya sistemi/yedekleme katmanı **mevcut kodda bulunmamaktadır**.

## Gerçek Mevcut Durum Envanteri

| Bileşen / Katman | Durum | Gerçek Kaynak Dosyası ve Fonksiyon / Sembol |
| :--- | :--- | :--- |
| Tarayıcı Giriş Sayfası | Mevcut | `index.html` (`<div id="root">`, `/src/main.tsx` modül yükleme) |
| İstemci Kök Bağlama | Mevcut | `src/main.tsx` (`createRoot(document.getElementById('root')!).render(<App />)`) |
| Ana Arayüz Bileşeni | Mevcut (Boş) | `src/App.tsx` (`App()` — yalnızca boş `<div></div>` döndürür) |
| Stil Girişi | Mevcut (Temel) | `src/index.css` (`@import "tailwindcss";`) |
| Derleme / Geliştirme Aracı | Mevcut | `vite.config.ts` (`defineConfig()`, `copy-unbundled-src-assets` / `closeBundle()`) |
| Electron Main Process | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok (`electron` bağımlılığı `package.json` içinde yoktur) |
| Preload & ContextBridge | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Renderer / IPC İstemcisi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok (`src/App.tsx` içinde herhangi bir IPC veya durum mantığı yoktur) |
| `WebContentsView` & Kalıcı Oturumlar | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Dosya Sistemi (`fs`/`path`) & Yedekleme | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |

---

## Alt Diyagram 1: Gerçek Mevcut Çalışma Alanı Mimarisi

Aşağıdaki diyagram yalnızca şu anda disk üzerinde **fiilen çalışan** modülleri ve derleme zincirini göstermektedir.

```mermaid
flowchart LR
    subgraph DevBuild["Derleme ve Geliştirme Katmanı (Mevcut)"]
        PKG["package.json<br/>dev: vite --port=3000<br/>build: vite build"]
        VITE["vite.config.ts<br/>defineConfig() + closeBundle()"]
        TS["tsconfig.json<br/>ES2022 / react-jsx"]
    end

    subgraph WebRuntime["Tarayıcı Çalışma Zamanı (Mevcut)"]
        HTML["index.html<br/>#root konteyneri"]
        MAINTSX["src/main.tsx<br/>createRoot()"]
        APP["src/App.tsx<br/>App() -> boş div"]
        CSS["src/index.css<br/>@import tailwindcss"]
    end

    PKG --> VITE
    VITE --> HTML
    HTML --> MAINTSX
    MAINTSX --> APP
    MAINTSX --> CSS
```

- **Gerçek Kaynak Dosyaları ve Fonksiyonlar:**
  - `vite.config.ts`: `defineConfig()` içinde `react()`, `tailwindcss()` eklentilerini ve derleme sonrası `src/assets` kopyalayan `closeBundle()` kancasını tanımlar.
  - `index.html`: `#root` düğümünü tanımlar ve `<script type="module" src="/src/main.tsx">` ile React uygulamasını yükler.
  - `src/main.tsx`: `createRoot(document.getElementById('root')!).render(<App />)` çağrısı ile `App` bileşenini bağlar.
  - `src/App.tsx`: `export default function App()` yalnızca boş `<div></div>` döndürür.

---

## Alt Diyagram 2: Renderer, Main Process, Preload ve IPC İlişkileri

Hedeflenen Electron mimarisindeki süreçler arası sınırların tamamı şu anda **`[GERÇEKLEŞMEMİŞ]`** durumdadır.

```mermaid
flowchart TB
    subgraph Renderer["Renderer Süreci"]
        R_CUR["Mevcut: src/App.tsx -> App() (Boş kabuk)<br/>IPC çağrısı yok"]
        R_MISS["[GERÇEKLEŞMEMİŞ] Orkestra Arayüzü<br/>window.electronAPI çağrıları yok"]
    end

    subgraph Preload["Preload Katmanı"]
        P_MISS["[GERÇEKLEŞMEMİŞ] preload.js<br/>contextBridge.exposeInMainWorld yok"]
    end

    subgraph Main["Main Process"]
        M_MISS["[GERÇEKLEŞMEMİŞ] main.js<br/>app / BaseWindow / BrowserWindow / ipcMain yok"]
    end

    R_CUR -. "IPC bağı mevcut değil" .-x P_MISS
    R_MISS -. "[GERÇEKLEŞMEMİŞ] contextIsolation köprüsü" .-> P_MISS
    P_MISS -. "[GERÇEKLEŞMEMİŞ] ipcRenderer.invoke / send" .-> M_MISS
```

- **Gerçek Kaynak Dosyası / Fonksiyonu:** Renderer yalnızca `src/App.tsx` (`App()`) ve `src/main.tsx` (`createRoot()`) ile sınırlıdır. Main Process, Preload ve IPC kanalları mevcut kodda yoktur.

---

## Alt Diyagram 3: `WebContentsView` ve Tarayıcı Oturum Yönetimi

Gemini, Claude, ChatGPT ve DeepSeek web oturumlarını kalıcı tutacak `WebContentsView` ve bölüm (`partition`) katmanı henüz yazılmamıştır.

```mermaid
flowchart LR
    subgraph MissingMain["[GERÇEKLEŞMEMİŞ] Main Process Görünüm Yöneticisi"]
        WIN["[GERÇEKLEŞMEMİŞ] Ana Pencere<br/>contentView.addChildView() yok"]
        SES["[GERÇEKLEŞMEMİŞ] Oturum Bölümü<br/>partition: persist:agent_session yok"]
        BOUNDS["[GERÇEKLEŞMEMİŞ] Görünüm Konumlandırma<br/>setBounds() senkronizasyonu yok"]
    end

    subgraph TargetSites["Harici Yapay Zekâ Web Arayüzleri (Bağlantı Yok)"]
        G["gemini.google.com"]
        C["claude.ai"]
        O["chatgpt.com"]
        D["chat.deepseek.com"]
    end

    WIN --> BOUNDS
    WIN --> SES
    SES -. "[GERÇEKLEŞMEMİŞ] View 1 (Mimar)" .-> G
    SES -. "[GERÇEKLEŞMEMİŞ] View 2 (Denetçi)" .-> C
    SES -. "[GERÇEKLEŞMEMİŞ] View 3 (Başmühendis)" .-> O
    SES -. "[GERÇEKLEŞMEMİŞ] Opsiyonel Seçim" .-> D
```

- **Gerçek Kaynak Dosyası / Fonksiyonu:** Mevcut kodda yok. `package.json` içinde `electron` paketi ve giriş noktası (`main`) tanımlı değildir.

---

## Alt Diyagram 4: Dosya Sistemi ve Yedekleme Katmanı

Yerel proje klasörünü okuma, plan `.md` dosyalarını yazma ve değişiklik öncesi yedek alma katmanı mevcut kodda bulunmamaktadır.

```mermaid
flowchart TD
    UI["src/App.tsx -> App()<br/>Dosya seçici veya editör yok"]
    FS["[GERÇEKLEŞMEMİŞ] Yerel Dosya Katmanı<br/>Node fs / path / dialog.showOpenDialog yok"]
    DIFF["[GERÇEKLEŞMEMİŞ] Değişiklik Önizleme<br/>Diff hesaplama fonksiyonu yok"]
    BAK["[GERÇEKLEŞMEMİŞ] Yedekleme Katmanı<br/>.bak / .studio-backups yazımı yok"]

    UI -. "Bağlı değil" .-> FS
    FS -. "[GERÇEKLEŞMEMİŞ]" .-> DIFF
    DIFF -. "[GERÇEKLEŞMEMİŞ]" .-> BAK
```

- **Not (`package.json` Bağımlılık Gözlemi):** `package.json` dosyasında `express`, `dotenv` ve `@google/genai` paketleri kurulu görünmekle birlikte, çalışma alanında bu paketleri içe aktaran herhangi bir sunucu dosyası (`server.ts`) veya istemci modülü **bulunmamaktadır**.
