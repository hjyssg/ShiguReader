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

* display the thumbnails of zip/rar/7zip files
* sort/search files
* re-compress images to save disk space
* move/delete files
* play music files that are in the compressed files
* play mp4/mkv/avi files and display their tags
* show statistics chart of all collections
* same color theme as exh**tai
* support Windows/*nix servers
* client can run on any modern browser(except IE/Edge), including mobile phone(no need to install other softwares)
* browse image files in folders 

### File Format Support

* Support regular zip/rar/7zip files  
* Format support of image/video/music files depends on the browser. Support typical jpg,png,png,mp4,avi,mp3,wav files  
* More details in src/util.js

### Instruction

* For windows, download the zip file
* Modify ini file, then click the ShiguReader.exe
* For *nix users and developers, please refer to [Readme_Env_Setup](https://github.com/hjyssg/ShiguReader/blob/dev/Readme_Env_Setup.md)

### Third Party Dependency
It is nice to have, but not necessary
install imagemagick  from https://imagemagick.org

##### Safety
ShiguReader is not safe when being accessed from the public IP. The server is not prepared for any cyber attack.

If you just want to read comic or watch anime when going outside, you can download the files to you tablet.
For example, my ipad has VLC for video and ComicGlass for comic. I download file in Chrome browser and save them to the apps.

##### How to use on NAS

Thanks to [this guy](https://github.com/hjyssg/ShiguReader/issues/90)

##### Hotkey

enter: browser enter/quit full screen
AD and left right arrow key: go to next/previous page
+-: zoom image

##### Caution
If you find the images with file name containing Japanese Kanji/Kana, you will need to change the language setting:
![unicode setting](screenshot/unicode-setting.png)
But it's also reported that this settimg will cause Mojibake in other softwares using non unicode encoding.

##### FAQ
    Q： I can open the webpage, but it is empty or 404.
    A: Please check your path-config.ini file

    Q：Why English Readme is much less than Chinese Readme?
    A: I received more questions from Chinese community. But I do provide enough information here.


##### Have any question?

If you have any question, just post in Github Issue.