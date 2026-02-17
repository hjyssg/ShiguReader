## 前端task
search页面需要加一个link，点下去可以open in a new tab。

https://exhentai.org/?f_search={刚才的搜索词}
https://sukebei.nyaa.si/?f=0&c=0_0&q={刚才的搜索词}

你想一下怎么设计好看


## 前端task
tag page的sort direction要和explorer页面的一样。考虑用共通component 

## frontend\src\components\Common\PathBreadcrumb.tsx
里面能被省略的label全部都要带title attribute

### 前端task
breadcrumb 的最后一个filename/foldername点击下去行为不统一
统一成点击下去 等于 ctrl + c filename/foldername

## 后端task 
coser pages大面积不是名单里面的coser，而是name parser解析出来的漫画家名字

列出实现计划，最后要有四个commit。


### 现在这个项目很多UI因为没有实现定义共通，经常出现重复时候和行为样式不一样。需要重构