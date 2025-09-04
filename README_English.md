# ShiguReader

![icon](screenshot/favicon-96x96.png)

[![Latest Release](https://img.shields.io/github/v/release/hjyssg/ShiguReader?label=latest%20release)](https://github.com/hjyssg/ShiguReader/releases)

[中文说明](README.md)

ShiguReader is a manga browser that can be used on computers or iPads. It also supports organizing resources, playing music, and watching videos. Download the [Release](https://github.com/hjyssg/ShiguReader/releases) to start using immediately.

## Documentation

- [Usage Instructions](Readme_Usage.md)
- [Development Environment Setup](Readme_Dev_Setup.md)

## Screenshots

![screenshot-01](screenshot/01.png)
![screenshot-02](screenshot/02.png)
![screenshot-02.5](screenshot/02.5.png)
![screenshot-03](screenshot/03.png)
![screenshot-04](screenshot/04.png)
![screenshot-05](screenshot/05.png)
![screenshot-06](screenshot/06.png)

## Key Features

- Can be used on computers and iPads
- Displays cover images of each manga archive for easy browsing
- Supports playing music and videos
- Provides various sorting and filtering functions, including sorting by favorites
- Compresses images in a comic archive with a single click, saving disk space
- Displays all files by specific authors or doujin types
- Allows moving and deleting files
- Generates statistical charts to show file sizes and file counts in different periods
- Adopts a color scheme similar to the old Panda website, giving you a sense of familiarity
- Supports both Windows and Linux systems

## Supported File Formats

The supported archive formats depend on 7Zip. Common formats such as zip, rar, and 7z are supported. The supported formats for images, music, and videos depend on the browser. Common image formats include jpg, png, and gif, while common video formats include mp4 and avi. The supported music formats include mp3 and wav, among others.

## Demo Videos

- [iPad demo](https://www.bilibili.com/video/BV1Mt4y1m7qU)
- [PC demo](https://www.bilibili.com/video/BV1t64y1u729/)
- [iPhone demo](https://www.bilibili.com/video/BV1xt4y1U73L/)

## Keyboard Shortcuts

**Comic Page**

- `Enter`: Fullscreen
- `A` / `D` or Left/Right arrow keys: Turn pages
- `W` / `S` or Up/Down arrow keys: Scroll vertically
- `+` and `-`: Zoom image
- `x`: Move to *no good* folder
- `v`: Move to *good* folder
- `g`: Quick jump to page

## Third-Party Dependencies

For Linux, it is highly recommended to install [ImageMagick](https://imagemagick.org). This allows you to use it to compress images and improve the software's performance.

## Notes

Some images with Chinese or Japanese characters in their filenames may fail to load. You may need to adjust the language settings. Be aware that this may cause garbled text in other non-Unicode software.

Windows language settings:

![Unicode Setting](screenshot/unicode-setting.png)

## Image Compression in Archives

[Introductory video](https://www.bilibili.com/video/BV1pi4y147Gu?from=search&seid=13429520178852889848/)

Some manga images can be extremely large—for example, a 24-page comic might take up 640MB while an equally detailed 30MB comic looks similar. This feature compresses images inside archives. First, ensure the `magick` command works in your command prompt. Then, start the compression program via the web page. Compressed files are saved by default to `workspace\\minified_zip_cache`.

## Usage with TamperMonkey

Add `EhentaiHighighliger.js` to TamperMonkey. When you browse the E-Hentai website, this script communicates with the backend server to show whether files have been downloaded.

## FAQ

**Q:** The software doesn't start after clicking the .exe file. What should I do?
**A:** The default port 3000 may already be in use. Try changing the port number, for example `ShiguReader_Backend.exe --port 5000`.

**Q:** Some videos cannot be played. What should I do?
**A:** Videos are only a supplementary feature, and their supported formats are limited.

**Q:** The software works fine on my computer, but after scanning the QR code, it doesn't open on my phone. How can I resolve this?
**A:** Please make sure that your computer and phone are connected to the same local Wi-Fi network. If it still doesn't open, check your computer's firewall settings.

**Q:** What does "ShiguReader" mean?
**A:** Shigure (しぐれ) + Reader. The Kantai Collection doujinshi from back then were really good.

## Feedback and Suggestions

If you have any questions or need assistance, please provide feedback through issues on GitHub. We also welcome any suggestions for improving ShiguReader.

