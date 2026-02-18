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



# task 
  现在内部跳转或者打开新页面缺乏统一管理。你需要进行统一


# task
  前端重构任务： 现在内部跳转或者打开新页面缺乏统一管理。你需要进行统一的url util去管理。
  

# bug
  后端解压archive不会去自动更新archive的meta吗？
  我的希望是解压/生成thumbnail的时候回去更新archive的meta。
  解压的时候，如果没有thumbnail也需要去生成。


# bug
/api/v1/parse?filepath=D%3A%5C_TEMP_DOWNLOADS%5CDLRAW.AC_Seitokai_nimo_Ana_wa_Aru%20vol%2001-11.rar parse不出东西，也不应该是404。应该是返回没有的就行了


# task
检查前后端的编译器warning。

# 现在不同layout的pagination的代码太长了。
一个pagination几十行，还不好统一行为。
        <Pagination className="grid-pagination">
            <PaginationContent>
              <PaginationItem>
                <PaginationFirst
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToPage(1)
                  }}
                  className={
                    page <= 1 ? "pointer-events-none opacity-50" : undefined
                  }
                />
              </PaginationItem>

              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToPage(page - 1)
                  }}
                  className={
                    page <= 1 ? "pointer-events-none opacity-50" : undefined
                  }
                />
              </PaginationItem>

              {visiblePages.map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => {
                      e.preventDefault()
                      goToPage(p)
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToPage(page + 1)
                  }}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>

              <PaginationItem>
                <PaginationLast
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    goToPage(totalPages)
                  }}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : undefined
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination


你去实现一个统一的pagination。然后替换


# task 
  search的mode和presence没有i18化。