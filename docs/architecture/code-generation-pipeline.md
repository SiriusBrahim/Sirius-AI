# 5. Kod Üretim ve Dosya Yazma Hattı (`code-generation-pipeline.md`)

> **Doğrulama Özeti:** Mevcut kaynak kod incelenmiştir. Proje dosyalarını okuyan, yapay zekâ yanıtındaki kod bloklarını ayrıştıran, diff önizlemesi gösteren, kullanıcı onayıyla diske yazan veya yedekleme/geri alma yapan **hiçbir boru hattı mevcut kodda bulunmamaktadır**.

## Kod Üretim Hattı Doğrulaması

| Boru Hattı Adımı | Durum | Gerçek Kaynak Dosyası / Fonksiyonu |
| :--- | :--- | :--- |
| Proje Dosyalarının Okunması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Kodlama Görevinin Hazırlanması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| AI Yanıtının Alınması ve Ayrıştırılması | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Dosya ve Kod Değişikliklerinin Belirlenmesi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Diff Önizlemesi | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Onay ve Dosyaya Yazma | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Yedekleme ve Geri Alma | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |

---

## Alt Diyagram 1: Kod Okuma, Görev Hazırlama ve Yanıt Ayrıştırma

```mermaid
flowchart LR
    R1["[GERÇEKLEŞMEMİŞ] Klasör Seçimi & Okuma<br/>fs.readdir / fs.readFile yok"] --> R2["[GERÇEKLEŞMEMİŞ] Görev Promptu Hazırlama<br/>Dosya içeriğini prompta ekleyici yok"]
    R2 --> R3["[GERÇEKLEŞMEMİŞ] AI Yanıtı Alma<br/>Web sayfasından çıktı okuma yok"]
    R3 --> R4["[GERÇEKLEŞMEMİŞ] Kod Bloğu Ayrıştırıcı<br/><pre><code> veya fenced block parser yok"]
    R4 --> R5["[GERÇEKLEŞMEMİŞ] Hedef Dosya Eşleştirme<br/>Hangi kodun nereye yazılacağı çözücü yok"]
```

- **Gerçek Kaynak Dosyası / Fonksiyonu:** Mevcut kodda yok. `vite.config.ts` içindeki `closeBundle()` fonksiyonu yalnızca `vite build` sırasında `src/assets` dizinini `dist/src/assets` içine kopyalamakla görevlidir; kullanıcı proje dosyalarını okumak veya AI kodu yazmak için kullanılmaz.

---

## Alt Diyagram 2: Diff Önizleme, Onay, Dosyaya Yazma ve Yedekleme/Geri Alma

```mermaid
flowchart TD
    B0["[GERÇEKLEŞMEMİŞ] Seçilen Kod Bloğu + Hedef Dosya"] --> B1["[GERÇEKLEŞMEMİŞ] Diff Hesaplama ve Önizleme<br/>Satır farkı gösteren bileşen yok"]
    B1 --> B2{"[GERÇEKLEŞMEMİŞ] Kullanıcı Onayı"}
    B2 -. "Onaylanırsa" .-> B3["[GERÇEKLEŞMEMİŞ] Otomatik Yedek Oluşturma<br/>.bak / .studio-backups yazımı yok"]
    B3 --> B4["[GERÇEKLEŞMEMİŞ] Dosyaya Atomik Yazma<br/>fs.writeFile / IPC handler yok"]
    B4 --> B5["[GERÇEKLEŞMEMİŞ] Geri Alma (Rollback)<br/>Yedekten geri yükleme mekanizması yok"]
    B2 -. "İptal edilirse" .-> B6["[GERÇEKLEŞMEMİŞ] Değişiklik Uygulanmaz"]
```

- **Belirsiz Noktalar (`[BELİRSİZ]`):**
  - AI yanıtı tam dosya yerine kısmi kod parçası (`... mevcut kod ...`) içerdiğinde akıllı yama (patch/AST merge) mı yapılacağı, yoksa tüm dosyanın mı üzerine yazılacağı mevcut kodda tanımlı değildir.
  - Çoklu dosya içeren tek bir AI yanıtının toplu (batch) uygulanıp uygulanamayacağı henüz kodlanmamıştır.
