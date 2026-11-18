# 7. Hata ve Kurtarma Mimarisi (`error-recovery.md`)

> **Doğrulama Özeti:** Mevcut kaynak kodda (`src/App.tsx`, `src/main.tsx`, `vite.config.ts`) herhangi bir `try/catch` hata sınırı, React `ErrorBoundary`, ağ/oturum denetimi, zaman aşımı sayacı, yeniden deneme kuyruğu veya çökme kurtarma mekanizması **bulunmamaktadır**.

## İstenen 8 Hata Senaryosunun Gerçekleşme Durumu

| # | Hata Senaryosu | Mevcut Durum | Gerçek Kaynak Dosyası / Fonksiyonu |
| :--- | :--- | :--- | :--- |
| 1 | Hedef web sitesinin erişilememesi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| 2 | Oturumun sona ermesi (Login/Cloudflare) | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| 3 | Prompt gönderiminin başarısız olması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| 4 | Yanıtın erken veya eksik algılanması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| 5 | Yanlış kod bloğunun çıkarılması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| 6 | Birden fazla ajanın aynı dosyayı değiştirmesi | `[GERÇEKLEŞMEMİŞ]` / `[BELİRSİZ]` | Mevcut kodda yok |
| 7 | Dosya yazma ve yedekleme hataları | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| 8 | Uygulamanın beklenmedik kapanması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |

---

## Alt Diyagram 1: Ağ, Oturum ve Prompt Gönderim Hataları (Senaryo 1–3)

```mermaid
flowchart TD
    E1["1. Hedef Site Erişilemiyor<br/>(DNS / Ağ / 5xx)"] --> H1["[GERÇEKLEŞMEMİŞ] did-fail-load dinleyicisi yok<br/>Hata yakalama mevcut değil"]
    E2["2. Oturum Sona Erdi / Captcha<br/>(Login yönlendirmesi)"] --> H2["[GERÇEKLEŞMEMİŞ] Auth/Login duvarı algılayıcı yok<br/>Kullanıcıya görünür sekme uyarısı yok"]
    E3["3. Prompt Gönderimi Başarısız<br/>(Input / Send seçici bulunamadı)"] --> H3["[GERÇEKLEŞMEMİŞ] Seçici fallback & Tekrar Dene yok<br/>Timeout sonrası kurtarma butonu yok"]
```

---

## Alt Diyagram 2: Yanıt Algılama ve Kod Bloğu Çıkarma Hataları (Senaryo 4–5)

```mermaid
flowchart TD
    E4["4. Yanıt Erken veya Eksik Algılandı<br/>(Thinking duraklaması)"] --> H4["[GERÇEKLEŞMEMİŞ] Çift doğrulamalı kontrol<br/>Stop/Send + 3sn metin sabitliği mevcut değil"]
    E5["5. Yanlış Kod Bloğu Çıkarıldı<br/>(Yanlış mesaj / bozuk dil etiketi)"] --> H5["[GERÇEKLEŞMEMİŞ] Yanıt sınırlandırıcı ve<br/>kullanıcı doğrulama adımı yok"]
```

---

## Alt Diyagram 3: Eşzamanlı Dosya Çakışması, Yazma Hatası ve Çökme Kurtarma (Senaryo 6–8)

```mermaid
flowchart TD
    E6["6. Çoklu Ajan Aynı Dosyayı Değiştirir"] --> H6["[GERÇEKLEŞMEMİŞ] / [BELİRSİZ] Dosya kilidi (lock)<br/>veya birleştirme politikası yok"]
    E7["7. Dosya Yazma / Yedekleme Hatası<br/>(EACCES / ENOSPC)"] --> H7["[GERÇEKLEŞMEMİŞ] Yazma öncesi yedek doğrulama<br/>ve işlem geri alma (rollback) yok"]
    E8["8. Beklenmedik Kapanma (Crash)"] --> H8["[GERÇEKLEŞMEMİŞ] Durum kalıcılığı (checkpoint)<br/>ve açılışta kaldığı yerden devam yok"]
```

- **Kritik Eksiklik:** Uygulamanın beklenmedik kapanması halinde boru hattı durumu (`pipelineState`) ve ara plan sürümleri diske otomatik checkpoint olarak kaydedilmediği için (şu an hiç durum yönetimi olmadığı için) kurtarma mümkün değildir.
