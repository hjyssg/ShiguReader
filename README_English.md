<h1 align="center">ShiguReader</h1>

[<img src="https://img.shields.io/github/v/release/hjyssg/ShiguReader?label=latest%20release">](https://github.com/hjyssg/ShiguReader/releases)
[<img src="https://img.shields.io/docker/v/liwufan/shigureader?label=docker%20version">](https://hub.docker.com/r/liwufan/shigureader)
[<img src="https://img.shields.io/docker/pulls/liwufan/shigureader.svg">](https://hub.docker.com/r/liwufan/shigureader)

ShiguReader is a manga browser that can be used on computers or iPads. It also supports various features such as organizing resources, playing music, and watching videos. Simply go to [Release](https://github.com/hjyssg/ShiguReader/releasesx) and download it to start using immediately.

##### Screenshots

<img src="screenshot/01.png" alt="screenshot-01" width="600"/>
<img src="screenshot/02.png" alt="screenshot-02" width="600"/>
<img src="screenshot/02.5.png" alt="screenshot-02.5" width="600"/>
<img src="screenshot/03.png" alt="screenshot-03" width="600"/>
<img src="screenshot/04.png" alt="screenshot-04" width="600"/>
<img src="screenshot/05.png" alt="screenshot-05" width="600"/>
<img src="screenshot/06.png" alt="screenshot-06" width="600"/>

##### Key Features

* Can be used on computers and iPads.
* Displays cover images of each manga archive for easy browsing.
* Supports playing music and videos.
* Provides various sorting and filtering functions.
* Can compress images in a comic archive with a single click, saving disk space.
* Displays all files by specific authors or doujin types.
* Allows moving and deleting files.
* Generates statistical charts to show file sizes and file counts in different periods.
* Adopts a color scheme similar to the old version of Panda website, giving you a sense of familiarity.
* The server-side supports both Windows and *nix systems.


##### Supported File Formats

The supported archive formats depend on 7Zip. Common formats such as zip, rar, and 7z are supported. The supported formats for images, music, and videos depend on the browser. Common image formats include jpg, png, and gif, while common video formats include mp4 and avi. The supported music formats include mp3 and wav, among others.

##### Keyboard Shortcuts

Manga Page
enter: Fullscreen
AD and left/right arrow keys: Page navigation
+-: Image zoom

##### Third-Party Dependencies

While ShiguReader can be used without installing dependencies, it is highly recommended to install [ImageMagick](https://imagemagick.org). This allows you to use it to compress images and improve the software's performance.

##### Usage with TamperMonkey

Add `EhentaiHighighliger.js` to TamperMonkey. When you visit the E-Hentai website, this script will communicate with the backend server to show whether files have been downloaded or not.

##### FAQ

Q: The software doesn't start after clicking the .exe file. What should I do?
A: The default port 3000 may already be in use. Try changing the port number.

Q: Some videos cannot be played. What should I do?
A: Videos are only a supplementary feature, and their supported formats are limited.

Q: The software works fine on my computer, but after scanning the QR code, it doesn't open on my phone. How can I resolve this?
A: Please make sure that your computer and phone are connected to the same local Wi-Fi network. If it still doesn't open, check your computer's firewall settings.

Q: What does "ShiguReader" mean?
A: ShiguReader is a combination of "Shigure" (しぐれ) and "Reader." The doujinshi of that era's Kantai Collection were really good.

##### Donations

If you like our software and would like to treat us to a cup of milk tea, you can donate by scanning the following QR code via WeChat:
<img alt="WeChat" src="https://i.imgur.com/4KY4BcN.jpg." data-canonical-src="https://i.imgur.com/4KY4BcN.jpg" height="300px"/>

##### Development Environment Setup

please refer to [Readme_Env_Setup](https://github.com/hjyssg/ShiguReader/blob/dev/Readme_Env_Setup.md).

##### Feedback and Suggestions

If you have any questions or need assistance, please provide feedback through issues on GitHub. We also welcome any suggestions for improving ShiguReader.





