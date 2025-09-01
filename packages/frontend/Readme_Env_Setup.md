##### Dev Environment Setup


###### Short Version:

```bash

npm i
npm run start

```

###### Detailed Version:
```bash
# Node.js 16 is recommended.

# Install ImageMagick from https://imagemagick.org.
# It is nice to have, but not necessary.

# For Mac and *nix, install 7-Zip on your own.

# If you are a Mac user living in China, remember to use an HTTP proxy.

# Clone the repository or download it.
git clone https://github.com/hjyssg/ShiguReader

# Modify the following files:
# - config-path.ini
# - config-etc.ini

## Windows default CMD may not work. Please install Git and Git Bash from https://git-scm.com/.

# Open the command prompt.
cd ShiguReader

# Install dependencies.
npm install

# If you live in China, I recommend the following:
npm install -g cnpm --registry=https://registry.npm.taobao.org
cnpm install

# Start the development server.
npm run start

# Open the link shown in the command prompt.

```


| Software      | Must Have | Note                           |
|---------------|-----------|--------------------------------|
| Node.js       | Yes       | Version 16 is recommended.      |
| image magick  | No        | Nice to have.                   |
| 7-Zip         | *      | Windows does not need to install. Must-have for *nix. |
| git bash      | *         | Must-have for Windows, not required for *nix. |