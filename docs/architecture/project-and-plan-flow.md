# 6. Proje ve Plan Yönetimi (`project-and-plan-flow.md`)

> **Doğrulama Özeti:** Mevcut kaynak kodda proje klasörünü yöneten, `plan_v1.md` / `plan_v2.md` / `plan_final.md` dosyalarını okuyan/güncelleyen, görev tamamlanma durumunu takip eden veya proje bağlamını ajanlara aktaran **hiçbir uygulama içi mekanizma bulunmamaktadır**.

## Plan ve Proje Yönetimi Doğrulaması

| Süreç | Durum | Gerçek Kaynak Dosyası / Fonksiyonu |
| :--- | :--- | :--- |
| Plan Dosyalarının Okunması ve Güncellenmesi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Plan Sürümlerinin İlişkileri (`v1` -> `v2` -> `final`) | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Ajanların Plan Üzerinden Çalışması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Görevlerin Tamamlanma Durumunun Yönetimi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Proje Bağlamının Ajanlara Aktarılması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |

> **Ayırım Notu:** AI Studio çalışma alanı içinde yer alan `.aistudio/artifacts/.../implementation_plan.md` yalnızca geliştirme ortamının planlama artifaktıdır; uygulamanın kendi çalışma zamanı (`src/App.tsx`, `src/main.tsx`) tarafından okunmaz veya yönetilmez.

---

## Alt Diyagram 1: Plan Sürüm İlişkileri ve Okuma/Güncelleme Akışı

```mermaid
flowchart LR
    P0["[GERÇEKLEŞMEMİŞ] Proje Fikri Girişi"] --> P1["[GERÇEKLEŞMEMİŞ] plan_v1.md<br/>Mimar çıktısı (diskte üretilmiyor)"]
    P1 --> EDIT1["[GERÇEKLEŞMEMİŞ] Kullanıcı Düzenleme / Onay"]
    EDIT1 --> P2["[GERÇEKLEŞMEMİŞ] plan_v2.md<br/>Denetçi revizyonu (diskte üretilmiyor)"]
    P2 --> EDIT2["[GERÇEKLEŞMEMİŞ] Kullanıcı Düzenleme / Onay"]
    EDIT2 --> P3["[GERÇEKLEŞMEMİŞ] plan_final.md<br/>Başmühendis nihai planı (diskte üretilmiyor)"]
```

---

## Alt Diyagram 2: Ajanların Plan ve Proje Bağlamı Üzerinden Çalışması

```mermaid
flowchart TD
    CTX["[GERÇEKLEŞMEMİŞ] Proje Dosya Ağacı + Seçili Dosyalar"] --> BINDER["[GERÇEKLEŞMEMİŞ] Bağlam Paketleyici<br/>Dosya özetleri + plan içeriği birleştirici yok"]
    PLAN["[GERÇEKLEŞMEMİŞ] Aktif Plan Dosyası (v1 / v2 / final)"] --> BINDER
    TASK["[GERÇEKLEŞMEMİŞ] Görev Durum Listesi<br/>Bekliyor / İşleniyor / Tamamlandı takibi yok"] --> BINDER
    BINDER -. "[GERÇEKLEŞMEMİŞ] Zenginleştirilmiş Prompt" .-> AGENT["[GERÇEKLEŞMEMİŞ] Aktif Ajan Sekmesi"]
```

- **Belirsiz Noktalar (`[BELİRSİZ]`):**
  - Çok büyük projelerde (`node_modules`, `dist`, büyük kod tabanları) hangi dosyaların bağlama dahil edilip hangilerinin dışlanacağına (ör. `.gitignore` filtresi veya token/karakter sınırı) dair hiçbir kural kodlanmamıştır.
  - `plan_final.md` üretildikten sonra içindeki alt görevlerin otomatik olarak tek tek kodlama görevlerine bölünüp bölünmeyeceği mevcut kodda tanımlı değildir.
