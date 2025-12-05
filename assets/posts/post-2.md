## 12 月 3 日小记

今天上午写了 12 月 2 日的小记，然后今天没有对网站相关的部分做出改动。今天下午主要尝试在 wsl 中下载和配置 gemini-cli。虽然 m1ng 学长给我提供了三段代码，但是实践起来在我的 wsl 中还是遇到了一点问题。

```bash
# 先获取脚手架工具 npm，属于 nodejs
sudo pacman -S node

# 再全局安装 gemini-cli

npm i -g @google/gemini-cli@latest

# 启动 gemini-cli 在浏览器关联谷歌账户即可

gemini
```

首先，就是运行后 ` sudo pacman -S node`，会显示 _not found_。原因是在 **Arch Linux** 中 **node.js** 包名称已经更新为 **nodejs**。所以只要写`sudo pacman -S nodejs`就可以完成下载。

然后，在运行安装 gemini-cli 的时候我又遇到了问题。当我使用`which gemini`时，显示我的 gemini 安装到了 **windows 目录下**，这使得我**无法打开** gemini。

> [!NOTE]我的解决方法
>
> 运行`mkdir -p ~/.npm-global`在 Arch WSL 的目录下创建一个名为`.npm-global`的隐藏文件夹。
>
> 运行`npm config set prefix '~/.npm-global`告诉 npm 将所有全局安装包放在这里。
>
> 运行`nvim ~/.bashrc`用自己喜欢的编辑器打开 bash 配置文件（我用的是 neovim ）。
>
> 在末尾添加以下`export PATH="$PATH:$HOME/.npm-global/bin`把新的目录添加到$PATH 变量中，保存并退出。
>
> 运行`source ~/.bashrc`激活新的配置。
>
> 运行`npm config get prefix`验证配置路径，如果输出`/home/用户名/.npm-global`就代表成功了。
>
> 没有问题然后就重新安装 gemini cli `npm install -g @google/gemini-cli@latest`
>
> 此时再`which gemini`应该就会输出`/home/yonagi/.npm-global/bin/gemini`

最后，是我遇到的最大的问题，每当我输入`gemini`时，就会整个终端就会卡住，但是输入`gemini --help`就可以正常输出。经过我的多方测试下发现是/gemini/settings.json 内部的问题导致。

解决方法首先是用文本编辑器`nvim ~/.gemini/settings.json`打开配置文件，确保内容只能是

```json
{
  "api_key": "你的GeminiAPI"
}
```

如果多了一部分东西大概率是通过网页登陆的凭证，由于登陆凭证在 WSL 中失败可能性高，使用应该把它删去后保存配置文件并退出。

此时再输入`gemini`就可以正常进入，然后选择第二项 APL 登录，再次输入 API 就可以在终端使用 Gemini 了。o(￣ ▽ ￣)ｄ

<img src="\assets\images\blog\gemini111.png">
