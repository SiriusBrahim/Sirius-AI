# 3. Tarayıcı Etkileşim Akışı (`browser-interaction.md`)

> **Doğrulama Özeti:** Mevcut kod tabanında Gemini, Claude, ChatGPT veya DeepSeek web arayüzlerine bağlanan, oturum açan, DOM seçicisi okuyan, prompt enjekte eden veya HTML yanıtını ayrıştıran **hiçbir modül bulunmamaktadır**.

## Tarayıcı Etkileşim Bileşenleri Doğrulaması

| Adım / Yetenek | Durum | Gerçek Kaynak Dosyası / Fonksiyonu |
| :--- | :--- | :--- |
| Hedef Yapay Zekâ Sayfasının Açılması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Oturum ve `WebContentsView` Yönetimi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Harici Seçici Yapılandırması (`selectors.json`) | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Prompt Enjeksiyonu (`clipboard` + `paste` vb.) | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Yanıt Tamamlanma Doğrulaması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Yanıt Metni ve Kod Bloklarının Çıkarılması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |

---

## Alt Diyagram 1: Hedef Sayfa Açılışı ve Oturum / `WebContentsView` Akışı

Mevcut uygulamada tarayıcı içinde yalnızca Vite tarafından sunulan `index.html` yüklenir; harici yapay zekâ URL'lerini açan ikinci bir tarayıcı görünümü mevcut değildir.

```mermaid
sequenceDiagram
    participant Browser as Kullanıcı Tarayıcısı (Mevcut)
    participant Vite as Vite Sunucusu (Mevcut)
    participant Main as [GERÇEKLEŞMEMİŞ] Electron Main
    participant View as [GERÇEKLEŞMEMİŞ] WebContentsView
    participant AI as Harici AI Web Sitesi

    Browser->>Vite: GET / (index.html)
    Vite-->>Browser: index.html + src/main.tsx (createRoot)
    Note over Browser,Vite: Gerçekleşen tek web etkileşimi budur.

    Main--xView: [GERÇEKLEŞMEMİŞ] WebContentsView oluşturma (partition: persist:agent_session)
    View--xAI: [GERÇEKLEŞMEMİŞ] loadURL(gemini / claude / chatgpt / deepseek)
    Main--xView: [GERÇEKLEŞMEMİŞ] setBounds() ile sekme görünürlüğü değiştirme
```

---

## Alt Diyagram 2: Prompt Enjeksiyonu, Tamamlanma Doğrulama ve Çıkarım Hattı

Planlanan DOM köprüsü (injector), yapıştırma tabanlı enjeksiyon, `MutationObserver` + sabitlik kontrolü ve `turndown` ile HTML → Markdown dönüşümü mevcut kodda bulunmamaktadır.

```mermaid
flowchart TD
    S0["[GERÇEKLEŞMEMİŞ] Seçici Okuma<br/>selectors.json yükleyicisi yok"] --> S1["[GERÇEKLEŞMEMİŞ] Giriş Kutusuna Odaklanma<br/>inputSelectors eşleşmesi yok"]
    S1 --> S2["[GERÇEKLEŞMEMİŞ] Pano / Paste Enjeksiyonu<br/>clipboard.writeText + webContents.paste yok"]
    S2 --> S3["[GERÇEKLEŞMEMİŞ] Gönder Butonu Tıklama<br/>sendButtonSelectors tetikleyici yok"]
    S3 --> S4["[GERÇEKLEŞMEMİŞ] Çift Doğrulamalı Bekleme<br/>Stop/Send kontrolü + metin sabitlik sayacı yok"]
    S4 --> S5["[GERÇEKLEŞMEMİŞ] Yanıt HTML Çıkarma<br/>Son mesaj balonu okuma yok"]
    S5 --> S6["[GERÇEKLEŞMEMİŞ] Markdown & Kod Bloğu Ayrıştırma<br/>turndown ve pre/code ayrıştırıcı yok"]
```

- **Gerçek Kaynak Dosyası / Fonksiyonu:** Mevcut kodda yok (`package.json` içinde `turndown` veya benzeri bir paket kurulu değildir).

---

## Alt Diyagram 3: Web Arayüzü (DOM) Değişikliklerinin Sisteme Etkisi

Sistem resmî API yerine yapay zekâların halka açık web arayüzlerini hedeflediği için, hedef sitelerin DOM yapısındaki değişiklikler kritik kırılma noktası oluşturur. Mevcut kodda bu etkiyi azaltacak harici `selectors.json` mekanizması veya geri dönüş (fallback) stratejisi henüz uygulanmamıştır.

```mermaid
flowchart LR
    DOM["Hedef Site Arayüz Güncellemesi<br/>(Gemini / Claude / ChatGPT / DeepSeek)"] --> RISK1["Giriş Alanı Seçicisi Bozulur<br/>(textarea / contenteditable değişimi)"]
    DOM --> RISK2["Durum Butonları Değişir<br/>(Stop / Send aria-label değişimi)"]
    DOM --> RISK3["Yanıt Konteyneri Değişir<br/>(Yanlış mesaj veya eksik kod bloğu)"]

    RISK1 --> GAP["[GERÇEKLEŞMEMİŞ] Harici selectors.json<br/>ve çoklu yedek seçici dizisi yok"]
    RISK2 --> GAP2["[GERÇEKLEŞMEMİŞ] Erken kesilme veya<br/>sonsuz bekleme tespiti yok"]
    RISK3 --> GAP3["[GERÇEKLEŞMEMİŞ] Boş/hatalı çıktı<br/>doğrulama ve Kurtarma mekanizması yok"]
```

- **Belirsiz Noktalar (`[BELİRSİZ]`):**
  - Anti-bot / Cloudflare Turnstile veya Google oturum doğrulama engelleriyle karşılaşıldığında kullanıcının manuel müdahale edebilmesi için görünür tarayıcı odağının nasıl devredileceği mevcut kodda tanımsızdır.
  - Seçici eşleşmediğinde kullanıcıya arayüzde seçici test/onarım aracı sunulup sunulmayacağı henüz kodlanmamıştır.
