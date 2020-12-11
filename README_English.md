# ShiguReader

Read Comic/Play Music and Video on all platforms


##### Demo Video
[demo video](https://youtu.be/nV24b6X6eeI)  

##### Screenshot

![screenshot-01](screenshot/01.png)
![screenshot-02](screenshot/02.png)
![screenshot-02](screenshot/02.5.png)
![screenshot-03](screenshot/03.png)
![screenshot-04](screenshot/04.png)
![screenshot-05](screenshot/05.png)
![screenshot-06](screenshot/06.png)

##### Features

* view the thumbnails of zip/rar/7zip files
* sort/search files
* re-compress images to save disk space
* move/delete files
* play music files inside compressed files
* play mp4/mkv/avi files
* show statistics chart of all collections
* same color theme as exh**tai
* server runs on Windows/*nix
* client runs on any modern browser(except IE)
* browse image files in folders <- New



##### Quick Start

```bash
# If you do not have Node.js installed, please go to https://nodejs.org/
# Node.js 14 is recommended

# install imagemagick  from https://imagemagick.org

# Clone the repository or download
git clone https://github.com/hjyssg/ShiguReader

## change user config
## modify src/path-config.ini  src/user-config.js accoding to your own comic files location

## Windows default cmd is not working
## Please install Git and Git Bash  https://git-scm.com/

# open Git Bash
cd ShiguReader

# Install dependencies
npm install

# for *nix people, please install 7zip on your own

# Start development server
npm run dev

# open the link shown on the git bash

```

| software      | must have | note                           |
|---------------|-----------|--------------------------------|
| Node.js       | yes       |                                |
| image magick  | no        | nice to have                |
| 7-Zip         | *         | Windows does not need to install. Must have for *nix    |
| everything    | no        | nice to have for Windows    |
| git bash      | *         | must have for Windows, no for *nix |
| MeCab         | no        | nice to have |

##### Safety
ShiguReader is not safe when being accessed from the public IP. The server is not prepared for any cyber attack.

If you just want to read comic or watch anime when going outside, you can just download files into you tablet.
For example, my ipad has VLC for video and ComicGlass for comic. I download file in Chrome browser and save them to the apps.

##### How to use on NAS

Thanks to [this guy](https://github.com/hjyssg/ShiguReader/issues/90)

##### Hotkey

enter: browser enter/quit full screen
AD and left right arrow key: go to next/previous page
+-: zoom image

##### FAQ
    Q： I can open the webpage, but it is empty or 404.
    A: Please check your path-config.ini file

    Q：Why English Readme is much less than Chinese Readme?
    A: I received more questions from Chinese community. But I do provide enough information here.


##### Have any question?

If you have any question, just post in Github Issue.