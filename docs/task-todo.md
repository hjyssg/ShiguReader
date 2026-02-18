# 未完成（Todo / In Progress / Bug）

## Task1：Zip 内大图压缩与再打包
- 参考：D:\Git\ShiguReader\packages
- 对 zip 内过大的图片进行压缩后重新打包 （用户可以在setting设置标准，你参考旧版：D:\Git\ShiguReader\packages）
- 支持选择：
  - 输出到原文件夹
  - 输出到专门目录
- 需要加UT


## Task9：测试补充
- 补充前后端 UT
- 保证所有页面可正常打开（可用 Playwright）


### task
打开带密码的zip
需要前端输出代码 然后去解压或者打开


### task
 archive page和explorer page太像。
 还有没有生成video .move文件的thumbnail


# 针对cosplay图包的优化
  对于压缩包，我们要区分漫画和cosplay图包。nameparser现在主要是日本发行的漫画。
  抽取coser的名字抽取 + 一个coserpage


# task
给代码加上你觉得合适需要的注释
进行你觉得合理应该的重构，保证项目之后还是好维护


## 后端task 
coser pages大面积不是名单里面的coser，而是name parser解析出来的漫画家名字


## task
   需要在前端让用户知道启动服务器的时候的要做什么，扫描和各种动作。否则用户会不安
   显示在home的最近活动。
   比如开始扫描，结束saomia 
      开始清除table之类。
   然后最近活动抽成一个component。之后可能移动到别的文件夹。
   你进行深度思考，告诉我怎么做最让用户不产生不熟悉的焦虑感。


# task 
  现在内部跳转或者打开新页面缺乏统一管理。你需要进行统一



# task
  前端重构任务： 现在内部跳转或者打开新页面缺乏统一管理。你需要进行统一的url util去管理。
  

# fs.py变成巨无霸了，需要重构一下。
  需要模块化

# bug
    FAVORITE和ALREADY_READ_DIR设置了，但为什么还显示没有。

    我看f12， http://127.0.0.1:5173/api/v1/fs/already-read
    返回的是

    <!DOCTYPE html>
<html lang="en">
  <head>
    <script type="module">import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;</script>

    <script type="module" src="/@vite/client"></script>

    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShiguReader</title>
    <link rel="icon" type="image/x-icon" href="/assets/images/favicon.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx?t=1771391221850"></script>
  </body>
</html>

明显有问题。

# task
move的文件夹目的地，就是之前使用过的可以smart suggestion。

