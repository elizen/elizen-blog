--- 
title: 使用 Hugo 从 0 到 1 搭建个人博客
author: Elizen
date: 2021-01-11
tags: tools
slug: start-hugo
draft: true
---

我喜欢一个关于知识分子的定义：**他们是研究理念的，他们永远要站在一个制度的对立面。**

这也是为什么我在信息爆炸的今天，依然推荐用 RSS 订阅的方式阅读新的信息，使用 Kindle 或者直接读纸质书，在独立博客发表文章，谨慎地使用抖音一类短视频服务。它们部分或全部地站在了当代社会的对立面。但在我看来，这却是回归到互联网本身的必经之路。

再一次细数我十年来的独立博客历程已无必要，无非是单调的一个时间列表。过程中，倒总是包含一个关键词「折腾」。如同麦克卢汉所说的「媒介即信息」，我选择独立博客作为我的信息传播渠道，也就必须融入这一传播介质之中。所以，这也是一篇关于「折腾」的文章。

在查阅多方资料，以及[木木哥][1]和其他朋友的帮助下，我从 2020 年开始使用 Hugo 重新搭建了自己的博客网站。最近，我想如法炮制，用最快的速度给自己一个新入手的域名搭建起一个网站，却发现，「建站」这件事是一件典型的超低频操作，一次建站，除了爱折腾的人，对于大部分像我一样，只是寻找一个能舒舒服服写东西的地方的人来说，几乎几年都不会有大的变动，所以当初对着电脑沉迷许久，体验心流顺利搭建出博客的过程，早已忘到九霄云外。

对此，就启发我要写下这样一篇文章，解决一下这几个问题：

- 面对像我一样纯粹的技术小白能够傻瓜式的如法炮制
- 搭建过程快速、简单、容易上手。

本文也因此分为两个章节，基础版和进阶版。

# 第一部分，基础版：使用 Github 搭建 Hugo 网站

## 1. 注册 Github，创建 repo

Github 是全世界程序员的福音书，一个技术人不可能不知道的开源技术社区。我们就从这里开始，体验它的美好。

注册 [Github][2]，就像注册任何网站一样。第一步，打开 Github（`https://github.com/ `）网站，点击`Sing Up`，输入自己的用户名、邮箱和密码，完成账户验证，点击`Create account`，之后可以选择你的职业，你想用 Github 做什么，或者干脆跳过，直接下一步。

img

第二步，查收你的邮箱，点击确认链接，完成注册。

img

第三步，点击右上角`+`，选择`New repository`,填写`Repository name`，点击`Create repository`。

img

到此，Github 上的工作就已经完成了。你会得到如下图一些完全看不懂的东西。没关系，我们开始下一步。

## 2. 安装 VS Code 和 Git，开启折腾之旅

### 2.1 安装 Git 参照 Windows 电脑上的文档

VS Code 是微软出品的一款程序员开发集成工具。我们不需要懂得这么多，只把它看成是我们的博客管理平台就可以了。

点击进入 VS Code [官网][3]，选择自己的版本下载，我这里是 Mac 版本。

img

Git 我们只需要直到它是一个版本管理工具，也是我们通往 Github 的钥匙。同样，打开 Git [官网][4]，下载自己对应的版本，安装，Windows 版本的同学可以参考安装 [视频][5]。

配置本地 Github 环境，**待补充**

### 2.2 安装 VS Code

如果安装不熟悉，就一路默认配置。安装完成，打开 VS Code 软件。点击`Extensions`，安装所需插件。在这里也推荐几个好用插件。

- gpm 用来管理 Github 上的文件。 **\#必备**
- Setting Sync 同步 Github 与本地文件。 **\#必备**
- Chinese Language Pack for Visual Studio Code VS Code 的汉化插件。 **\#推荐**
- Auto Rename Tag 如果涉及修改代码的时候，非常好用。 **\#推荐**
- Markdown All in One 使用 Markdown 写作的利器。 **\#必备**
- Material Icon Theme 一套个性的图标主题。 **\#推荐**

img

现在，打开你的 Github 选择刚才建立的 Repo，复制它的 HTTPS 链接，在 VS Code 中切换左侧边栏到 Project Management（项目管理）中，点击`+`，粘贴地址，回车。

img

之后就可以在 gpm 中找到相应的 Github 项目。`右键`点击你的项目名，选择在文件管理器中打开。

img

### 2.3 下载安装博客安装文件包

点击[下载]()我准备好的 `Blog` 网站文件。将下载好的文件解压后，Copy 到项目文件夹。

img

解压后的文件内容目录如下：

```bash
├── archetypes
│   └── default.md
├── config.toml #Hugo配置文件
├── content
│   ├── books.md
│   ├── movies.md
│   ├── photos.md
│   └── posts #文章文件夹，可以后续更改
│       ├── change-valine-comments.md
│       ├── hugo-single-link.md
│       ├── huo-zha-le.md
│       └── update-blog-single-photos.md
├── static #静态文件存储
│   ├── images
│   └── photos
│       └── 刘堃现场.jpeg
└── themes #网站的主题文件夹
    └── hyde
        ├── CHANGELOG.md
        ├── LICENSE.md
        ├── README.md
        ├── archetypes
        │   └── default.md
        ├── go.mod
        ├── images
        │   ├── screenshot.png
        │   └── tn.png
        ├── layouts
        │   ├── 404.html
        │   ├── _default
        │   │   ├── baseof.html
        │   │   ├── books.html
        │   │   ├── list.html
        │   │   ├── movies.html
        │   │   ├── path.html
        │   │   ├── photos.html
        │   │   ├── single.html
        │   │   └── terms.html
        │   ├── index.html
        │   ├── partials
        │   │   ├── comments.html
        │   │   ├── head.html
        │   │   ├── head_fonts.html
        │   │   ├── hook_head_end.html
        │   │   └── sidebar.html
        │   └── shortcodes
        │       ├── link.html
        │       └── music.html
        ├── static
        │   ├── Bmdb.min.css
        │   ├── Bmdb.min.js
        │   ├── apple-touch-icon-144-precomposed.png
        │   ├── css
        │   │   ├── hyde.css
        │   │   ├── poole.css
        │   │   ├── print.css
        │   │   └── syntax.css
        │   └── favicon.png
        └── theme.toml
```

### 2.4 安装博客文件

回到 VS Code，打开项目管理，右键自己的项目，选择在当前窗口打开或者新窗口打开。接下来，就可以开始工作了。

点击 `config.toml`，进行网站的基本配置，修改`baseURL`的地址为`https://你的用户名.github.com/你的仓库名/ `，例如我的就为`https://ittenblunt.github.com/my-blog/ `。

修改`title`、`description `,同时可以将 `Menus` 中的链接全部替换为自己的。

点击左侧边栏`源代码管理`，在`消息`框中随便输入，例如「Updata my blog」，点击对勾。点击左下角master旁边的上传，之后会弹窗，关联自己的 Github，在弹出的网页中同意关联。

第一次 push 到 Github，**待补充**。

### 2.5 配置 Github Action 实现自动化部署（参照木木哥https://immmmm.com/hugo-github-actions/）

第一步，Setting 中设置 Token，暂存。

img

第二步，进项目 settings/secrets 新建标题为 personal_token ，内容是刚创建的 tokens ;_

img

回项目点`Action - Set up a workflow yourself ` 添加如下代码：

```bash
name: Deploy Hugo # 任君喜欢

on:
  push:
    branches:
      - master   # master 更新触发

jobs:
  build-deploy:
    runs-on: ubuntu-18.04
    steps:
      - uses: actions/checkout@v1

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: latest

      - name: Build 
        run: hugo

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          personal_token: ${{ secrets.personal_token }} # personal_token 这里新建一个 https://github.com/settings/tokens
          PUBLISH_BRANCH: gh-pages  # 推送到当前 gh-pages 分支
          PUBLISH_DIR: ./public  # hugo 生成到 public 作为跟目录
          commit_message: ${{ github.event.head_commit.message }}
```

Commit 提交，你的播客也就做好了。现在可以访问你的博客地址，欣赏一下自己的成果。

## 3. 博客配置

### 3.1 基本配置

### 3.2 主题

### 3.3 评论

### 3.4 短代码




[1]:	https://immmmm.com
[2]:	https://github.com/
[3]:	https://code.visualstudio.com/
[4]:	https://git-scm.com/
[5]:	https://www.bilibili.com/video/av54010965
