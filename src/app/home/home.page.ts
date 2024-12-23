import { Component, OnInit } from '@angular/core';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AlertController, LoadingController, ModalController, Platform, ToastController } from '@ionic/angular';
import { LensFacing, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Clipboard } from '@capacitor/clipboard';
import { BarcodeScanningModalComponent } from './barcode-scanning-modal.component';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  segment: string = "scan";
  qrTextToGenerate: string = "";
  scanResult: string = "";

  constructor(
    private loadingController: LoadingController,
    private modalController: ModalController,
    private toastController: ToastController,
    private alertController: AlertController,
    private platform: Platform
  ) { }

  ngOnInit(): void {
    if (this.platform.is('capacitor')) {
      BarcodeScanner.isSupported().then();
      BarcodeScanner.checkPermissions().then();
      BarcodeScanner.removeAllListeners();
    }
  }

  async startScan() {
    const modal = await this.modalController.create({
      component: BarcodeScanningModalComponent,
      cssClass: 'barcode-scanning-modal',
      showBackdrop: false,
      componentProps: {
        formats: [],
        lensFacing: LensFacing.Back
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data) {
      this.scanResult = data?.barcode?.displayValue;
    }

  }

  async readBarcodeFromImage() {
    const { files } = await FilePicker.pickImages({ limit: 1 });
    const path = files[0]?.path;
    if (!path) return;

    const { barcodes } = await BarcodeScanner.readBarcodesFromImage({ path, formats: [] });
    this.scanResult = barcodes[0].displayValue;
  }

  async writeToClipboard() {
    await Clipboard.write({
      string: this.scanResult
    });

    const toast = await this.toastController.create({
      message: 'Resultado copiado en el portapapeles.',
      duration: 1000,
      color: 'tertiary',
      icon: 'clipboard-outline',
      position: 'bottom'
    });
    toast.present();
  }

  async openSiteInBrowser() {
    const alert = await this.alertController.create({
      header: '¿Estas seguro?',
      message: 'Navegar al sitio web',
      mode: 'md',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        }, {
          text: 'Continuar',
          handler: async () => {
            let url = this.scanResult;
            if (!['https://'].includes(this.scanResult)) url = 'https://' + this.scanResult;
            await Browser.open({ url });
          }
        }
      ]
    });

    await alert.present();
  }

  isUrl() {
    let regex = /\.(com|net|io|me|crypto|ai|co)\b/i;
    return regex.test(this.scanResult);
  }

  /* ============================================ */

  captureScreen() {
    const element = document.getElementById("qr-image") as HTMLElement;
    html2canvas(element).then((canvas: HTMLCanvasElement) => {
      if (this.platform.is('capacitor')) this.shareImageMobile(canvas)
      else this.downloadImageWeb(canvas);
    })
  }

  /**
   * downloadImageWeb
   * Solo funciona con web
   */
  downloadImageWeb(canvas: HTMLCanvasElement) {
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = `qr.png`
    link.click();
  }

  /**
   * shareImageMobile
   * Solo funciona con mobile
   */
  async shareImageMobile(canvas: HTMLCanvasElement) {
    let base64 = canvas.toDataURL();
    let path = `qr.png`

    const loading = await this.loadingController.create({
      spinner: 'crescent'
    });
    await loading.present();

    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
    }).then(async (res) => {
      let uri = res.uri;

      await Share.share({ url: uri });
      await Filesystem.deleteFile({
        path,
        directory: Directory.Cache
      });
    }).finally(() => {
      loading.dismiss();
    })
  }

}
