# 4. Çoklu Ajan Orkestrasyonu (`multi-agent-orchestration.md`)

> **Doğrulama Özeti:** Mevcut kaynak kod incelenmiştir. Uygulamada çoklu ajan boru hattı, görev dağıtıcısı, bağlam aktarım mekanizması, çıktı toplayıcı veya çakışma çözücü **bulunmamaktadır**. Aşağıdaki diyagramlar hem mevcut boş durumu hem de tanımlanmamış/gerçekleşmemiş orkestrasyon noktalarını göstermektedir.

## Orkestrasyon Yetenekleri Doğrulaması

| Orkestrasyon Başlığı | Durum | Gerçek Kaynak Dosyası / Fonksiyonu |
| :--- | :--- | :--- |
| Ajanlar Arası Görev Dağılımı | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Sıralı veya Bağımsız Çalışma İlişkisi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Ortak Görev ve Proje Bağlamı Aktarımı | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Ajan Sonuçlarının Toplanması ve Değerlendirilmesi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Çakışan / Uyumsuz Sonuçların Ele Alınması | `[GERÇEKLEŞMEMİŞ]` / `[BELİRSİZ]` | Mevcut kodda yok |

---

## Alt Diyagram 1: Mevcut Durum vs. Gerçekleşmemiş Sıralı Boru Hattı

```mermaid
flowchart LR
    subgraph Current["Mevcut Kod (Doğrulanmış)"]
        C1["src/main.tsx -> createRoot()"] --> C2["src/App.tsx -> App()<br/>Orkestra durumu yok"]
    end

    subgraph Unimplemented["[GERÇEKLEŞMEMİŞ] Planlanan 3 Aşamalı Sıralı Boru Hattı"]
        U0["Ham Proje Fikri"] --> U1["[GERÇEKLEŞMEMİŞ] Ajan 1: Mimar<br/>plan_v1.md üretimi yok"]
        U1 --> U2["[GERÇEKLEŞMEMİŞ] Geçiş / Mod Kontrolü<br/>4sn Oto-Bekleme veya Manuel Onay yok"]
        U2 --> U3["[GERÇEKLEŞMEMİŞ] Ajan 2: Denetçi<br/>plan_v2.md üretimi yok"]
        U3 --> U4["[GERÇEKLEŞMEMİŞ] Ajan 3: Başmühendis<br/>plan_final.md üretimi yok"]
    end
```

- **Bağımsız vs. Sıralı Çalışma Durumu:** Mevcut kodda ne sıralı (pipeline) ne de paralel (bağımsız) çalışan bir ajan koordinatörü vardır. Birden fazla `WebContentsView` örneğinin arka planda açık tutulması yalnızca oturumların korunması içindir; eşzamanlı görev çalıştırıcı da mevcut kodda yoktur.

---

## Alt Diyagram 2: Bağlam Aktarımı ve Sonuç Toplama Eksikliği

```mermaid
sequenceDiagram
    participant User as Kullanıcı
    participant App as src/App.tsx -> App() (Mevcut)
    participant Orch as [GERÇEKLEŞMEMİŞ] Orkestratör
    participant A1 as [GERÇEKLEŞMEMİŞ] Mimar
    participant A2 as [GERÇEKLEŞMEMİŞ] Denetçi
    participant A3 as [GERÇEKLEŞMEMİŞ] Başmühendis

    User->>App: Sayfa yüklenir (etkileşimli alan yok)
    User--xOrch: [GERÇEKLEŞMEMİŞ] Görev + Proje Bağlamı Girişi
    Orch--xA1: [GERÇEKLEŞMEMİŞ] Rol Şablonu + Görev
    A1--xOrch: [GERÇEKLEŞMEMİŞ] plan_v1.md çıktısı
    Orch--xA2: [GERÇEKLEŞMEMİŞ] Denetçi Şablonu + plan_v1.md
    A2--xOrch: [GERÇEKLEŞMEMİŞ] plan_v2.md çıktısı
    Orch--xA3: [GERÇEKLEŞMEMİŞ] Başmühendis Şablonu + plan_v2.md
    A3--xOrch: [GERÇEKLEŞMEMİŞ] plan_final.md + kod blokları
```

---

## Alt Diyagram 3: Çakışan veya Uyumsuz Sonuçların Ele Alınması (`[BELİRSİZ]` Alanlar)

Ajanların farklı mimari kararlar üretmesi, önceki ajanın dosya adını değiştirmesi veya çelişkili kod blokları döndürmesi halinde nasıl karar verileceği mevcut kodda **tanımlanmamıştır**.

```mermaid
flowchart TD
    CONFLICT["[GERÇEKLEŞMEMİŞ] Çakışan Ajan Çıktıları<br/>(Örn. Ajan 2 ile Ajan 3 farklı dosya yapısı önerir)"]
    CONFLICT --> B1["[BELİRSİZ] Otomatik Birleştirme Yok<br/>Hangi ajanın çıktısının baskın olacağı kodlanmamış"]
    CONFLICT --> B2["[BELİRSİZ] Şema / Kalite Değerlendirici Yok<br/>Yanıtın geçerliliğini ölçen değerlendirme yok"]
    CONFLICT --> B3["[GERÇEKLEŞMEMİŞ] Manuel Müdahale Kapısı<br/>Kullanıcının ara çıktıyı düzenleyip aktarması yok"]
```
