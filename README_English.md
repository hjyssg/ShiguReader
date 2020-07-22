# ShiguReader

Read Comic/Play Music and Video on all platforms

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



##### Demo Video
[demo video](https://youtu.be/nV24b6X6eeI)  

##### Screenshot

![screenshot-01](screenshot/01.png)
![screenshot-02](screenshot/02.png)
![screenshot-03](screenshot/03.png)
![screenshot-04](screenshot/04.png)
![screenshot-05](screenshot/05.png)
![screenshot-06](screenshot/06.png)


##### Quick Start

```bash
# If you do not have nodejs installed, please go to https://nodejs.org/

# install imagemagick  from https://imagemagick.org

# Clone the repository or download
git clone https://github.com/hjyssg/ShiguReader

## change user config
## modify src/path-config  src/user-config.js accoding to your own comic files location

## windows default cmd is not working
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


If you have any question, just write the question in Github Issue