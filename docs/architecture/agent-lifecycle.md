# 2. Ajan Yaşam Döngüsü (`agent-lifecycle.md`)

> **Doğrulama Özeti:** Mevcut kaynak kod incelenmiştir. Uygulamada herhangi bir yapay zekâ ajanı nesnesi, ajan havuzu, durum makinesi, zamanlayıcı (timeout), tekrar deneme veya duraklatma/devam ettirme mekanizması **bulunmamaktadır**. Tek yürütülen bileşen `src/App.tsx` içindeki boş `App()` fonksiyonudur.

## Gerçekleşmeyen Yaşam Döngüsü Durumu

| Yaşam Döngüsü Evresi | Durum | Gerçek Kaynak Dosyası / Fonksiyonu |
| :--- | :--- | :--- |
| Ajan Oluşturma ve Başlatma | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Görev Atama ve Prompt Gönderme | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Yanıt Bekleme ve Tamamlanma Algılama | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Timeout ve Tekrar Deneme (Retry) | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Duraklatma ve Devam Ettirme | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |
| Hata ve İptal Durumları | `[GERÇEKLEŞMEMİŞ]` | Mevcut kodda yok |

---

## Alt Diyagram 1: Ajan Oluşturma, Başlatma ve Görev Atama Akışı

Mevcut kodda ajan örneği veya yapılandırma deposu bulunmadığından aşağıdaki adımların tamamı `[GERÇEKLEŞMEMİŞ]` olarak işaretlenmiştir.

```mermaid
flowchart TD
    START(["Uygulama Açılışı<br/>src/main.tsx -> createRoot()"]) --> APP["src/App.tsx -> App()<br/>Boş <div></div> döner"]
    APP -. "Buradan sonrası mevcut kodda yok" .-> INIT["[GERÇEKLEŞMEMİŞ] Ajan Oluşturma<br/>Mimar / Denetçi / Başmühendis tanımları yok"]
    INIT -. "[GERÇEKLEŞMEMİŞ]" .-> VIEW["[GERÇEKLEŞMEMİŞ] Tarayıcı Görünümü Başlatma<br/>WebContentsView veya oturum yükleme yok"]
    VIEW -. "[GERÇEKLEŞMEMİŞ]" .-> ASSIGN["[GERÇEKLEŞMEMİŞ] Görev Atama ve Şablon Birleştirme<br/>Rol promptu + görev metni birleştirici yok"]
    ASSIGN -. "[GERÇEKLEŞMEMİŞ]" .-> SEND["[GERÇEKLEŞMEMİŞ] Prompt Enjeksiyonu ve Gönderim<br/>Pano/paste veya DOM tıklama yok"]
```

- **Gerçek Kaynak Dosyaları ve Fonksiyonlar:**
  - `src/main.tsx`: `createRoot()` yalnızca React kökünü başlatır.
  - `src/App.tsx`: `App()` boş `<div></div>` döndürür; ajan listesi, state (`useState`/`useReducer`) veya efekt (`useEffect`) içermez.

---

## Alt Diyagram 2: Yanıt Bekleme, Tamamlanma Algılama ve Hata/Timeout Durumları

Yanıtın akış (streaming) halinden çıkıp tamamlandığını doğrulayan gözlemci, 3 dakikalık zaman aşımı (timeout), tekrar deneme ve iptal/duraklatma durum makinesi mevcut kodda yer almamaktadır.

```mermaid
stateDiagram-v2
    [*] --> MevcutBosUygulama : src/main.tsx -> createRoot()

    state MevcutBosUygulama {
        [*] --> BosRender : src/App.tsx -> App()
    }

    state "[GERÇEKLEŞMEMİŞ] Ajan Durum Makinesi" as Unimpl {
        [*] --> Hazir : [GERÇEKLEŞMEMİŞ] Idle
        Hazir --> Enjeksiyon : [GERÇEKLEŞMEMİŞ] Görev Atama
        Enjeksiyon --> YanitBekleniyor : [GERÇEKLEŞMEMİŞ] Prompt Gönderildi
        YanitBekleniyor --> Duraklatildi : [GERÇEKLEŞMEMİŞ] Kullanıcı Duraklatması
        Duraklatildi --> YanitBekleniyor : [GERÇEKLEŞMEMİŞ] Devam Et
        YanitBekleniyor --> TamamlanmaDogrulama : [GERÇEKLEŞMEMİŞ] Stop Kayboldu / Send Aktif
        TamamlanmaDogrulama --> Tamamlandi : [GERÇEKLEŞMEMİŞ] Sabitlik Penceresi Geçti
        YanitBekleniyor --> ZamanAsimi : [GERÇEKLEŞMEMİŞ] Timeout Süresi Doldu
        YanitBekleniyor --> HataDurumu : [GERÇEKLEŞMEMİŞ] Seçici / Sayfa Hatası
        ZamanAsimi --> Enjeksiyon : [GERÇEKLEŞMEMİŞ] Tekrar Dene
        HataDurumu --> Enjeksiyon : [GERÇEKLEŞMEMİŞ] Tekrar Dene
        YanitBekleniyor --> IptalEdildi : [GERÇEKLEŞMEMİŞ] Kullanıcı Sıfırladı / İptal
        Tamamlandi --> [*]
        IptalEdildi --> [*]
    }
```

---

## Alt Diyagram 3: Duraklatma, Devam Ettirme ve Tekrar Deneme Belirsizlikleri

Kod henüz yazılmadığı için kontrol akışında aşağıdaki noktalar **`[BELİRSİZ]`** durumdadır:

```mermaid
flowchart LR
    Q1["[BELİRSİZ] Duraklatma Davranışı<br/>Akış ortasında durdurma mı,<br/>yoksa sonraki aşama geçişini bekletme mi?"]
    Q2["[BELİRSİZ] Timeout Eşikleri<br/>Aşama başına sabit süre mi,<br/>sağlayıcıya göre yapılandırılabilir mi?"]
    Q3["[BELİRSİZ] Tekrar Deneme Sınırı<br/>Otomatik retry sayısı var mı,<br/>yoksa yalnızca manuel buton mu?"]
    Q4["[BELİRSİZ] İptal Temizliği<br/>İptal edildiğinde aktif sekmedeki<br/>Stop butonuna tıklanacak mı?"]
```

- **Sonuç:** Ajan yaşam döngüsüne ait hiçbir dosya, sınıf, hook veya zamanlayıcı fonksiyonu mevcut kaynak kodda bulunmamaktadır.
