##### Dev Environment Setup

```bash
# If you do not have Node.js installed, please go to https://nodejs.org/
# Node.js 14 is recommended

# install imagemagick  from https://imagemagick.org
# It is nice to have, but is fine without it

# For Mac and *nix, install 7zip by your own
# If you are a Mac user who lives in China, remember use http proxy 
# https://www.logcg.com/archives/1617.html

# Clone the repository or download
git clone https://github.com/hjyssg/ShiguReader

## modify 
##    config-path.ini  
##    config-move-path.ini
##    config-etc.ini
#     user-config.js accoding to your own comic files location

## Windows default cmd is not working
## Please install Git and Git Bash  https://git-scm.com/

# open Git Bash
cd ShiguReader

# Install dependencies
npm install

#If you live in China, I recommend the following
npm install -g cnpm --registry=https://registry.npm.taobao.org
cnpm install 

# for *nix people, please install 7zip on your own

# Start development server
npm run dev

# open the link shown on the git bash

```

| software      | must have | note                           |
|---------------|-----------|--------------------------------|
| Node.js       | yes       | version 14 will be good        |
| image magick  | no        | nice to have                   |
| 7-Zip         | *      | Windows does not need to install. Must have for *nix |
| git bash      | *         | must have for Windows, no for *nix |
| MeCab         | no        | nice to have |