import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application'

import {
  ICommandPalette,
  MainAreaWidget,
  WidgetTracker,
  ToolbarButton
} from '@jupyterlab/apputils'

import { ISettingRegistry } from '@jupyterlab/settingregistry'

import { ILauncher } from '@jupyterlab/launcher'

import { Widget } from '@lumino/widgets'
import { ISignal, Signal } from '@lumino/signaling'
import { refreshIcon, LabIcon } from '@jupyterlab/ui-components' // imageIcon, jupyterIcon

const astronautIcon = new LabIcon({
  name: 'nasa-daily-pic:rocket-icon',
  // 这里填入 Font Awesome 图标的 SVG 字符串
  svgstr:
    '<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.--><path fill="navy" d="M156.6 384.9L125.7 354c-8.5-8.5-11.5-20.8-7.7-32.2c3-8.9 7-20.5 11.8-33.8L24 288c-8.6 0-16.6-4.6-20.9-12.1s-4.2-16.7 .2-24.1l52.5-88.5c13-21.9 36.5-35.3 61.9-35.3l82.3 0c2.4-4 4.8-7.7 7.2-11.3C289.1-4.1 411.1-8.1 483.9 5.3c11.6 2.1 20.6 11.2 22.8 22.8c13.4 72.9 9.3 194.8-111.4 276.7c-3.5 2.4-7.3 4.8-11.3 7.2v82.3c0 25.4-13.4 49-35.3 61.9l-88.5 52.5c-7.4 4.4-16.6 4.5-24.1 .2s-12.1-12.2-12.1-20.9V380.8c-14.1 4.9-26.4 8.9-35.7 11.9c-11.2 3.6-23.4 .5-31.8-7.8zM384 168a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"/></svg>'
})

interface ICount {
  clickCount: number
}
const BUTTON_WIDGET_CLASS = 'jp-button-widget'
class CountButtonWidget extends Widget {
  constructor(options = { node: document.createElement('button') }) {
    super(options)

    this.addClass(BUTTON_WIDGET_CLASS)

    // 创建旋转图标
    this.spinner = document.createElement('div')
    this.spinner.className = 'fa fa-sync-alt' //fa-solid fa-arrows-rotate fa-rotate
    this.spinner.style.display = ''
    // 将旋转图标作为按钮的子元素
    this.node.appendChild(this.spinner)

    // this.node.textContent = 'Refresh';

    this.node.addEventListener('click', () => {
      this._count.clickCount = this._count.clickCount + 1
      this._stateChanged.emit(this._count)
    })
  }

  public spinner: HTMLDivElement

  private _count: ICount = {
    clickCount: 0
  }

  private _stateChanged = new Signal<CountButtonWidget, ICount>(this)

  public get stateChanged(): ISignal<CountButtonWidget, ICount> {
    return this._stateChanged
  }
}

interface INASAResponse {
  copyright: string
  date: string
  explanation: string
  media_type: 'video' | 'image'
  title: string
  url: string
}

class NASAWidget extends Widget {
  // The image element associated with the widget.
  readonly imageContainer: HTMLDivElement
  readonly img: HTMLImageElement
  // The summary text element associated with the widget.
  readonly summary: HTMLParagraphElement
  readonly copyright: HTMLParagraphElement
  // 定义 icon 元素
  readonly spinner: HTMLDivElement

  readonly refreshbutton: CountButtonWidget
  // API key for the NASA API
  private apiKey: string

  /**
   * Construct a new NASA widget.
   */
  constructor(userSettings: ISettingRegistry.ISettings | null) {
    super()

    this.addClass('nasa-widget')

    this.apiKey = (userSettings?.composite['api_key'] as string) || 'DEMO_KEY'

    this.refreshbutton = new CountButtonWidget()
    // this.addWidget(this._button);
    this.node.appendChild(this.refreshbutton.node)
    this.refreshbutton.stateChanged.connect(this._onRefresh, this)

    // 创建包裹容器
    this.imageContainer = document.createElement('div')
    this.imageContainer.className = 'image-container' // 设置类名以便样式化

    // 添加图片元素到包裹容器
    this.img = document.createElement('img')
    this.imageContainer.appendChild(this.img)

    // 添加摘要元素到面板
    this.summary = document.createElement('p')
    this.summary.className = 'nasa-summary' // 为摘要元素设置一个类名
    this.node.appendChild(this.summary)

    // 添加版权信息到面板
    this.copyright = document.createElement('p')
    this.copyright.className = 'nasa-copyright' // 为版权信息设置一个类名
    this.imageContainer.appendChild(this.copyright)

    // 创建并添加旋转图标
    this.spinner = document.createElement('div')
    this.spinner.className = 'fa fa-spinner fa-spin' // 使用 Font Awesome 的旋转图标
    // this.spinner.className = 'fa fa-rocket fa-spin'
    this.spinner.style.display = 'none' // 默认隐藏
    this.node.appendChild(this.spinner)

    this.node.appendChild(this.imageContainer)

    // 为图片添加加载完成的监听器
    this.img.onload = () => {
      // 图片加载完成后的操作
      this.onImageLoaded()
    }
  }

  private _onRefresh(emitter: CountButtonWidget, count: ICount): void {
    this.updateNASAImage()
    console.log('Hey, a Signal has been received from', emitter)
    console.log(`Image refreshed ${count.clickCount} times.`)
  }

  // 图片加载完成后的处理函数
  private onImageLoaded(): void {
    // 隐藏旋转图标
    this.refreshbutton.spinner.className = 'fa fa-sync-alt'
    this.spinner.style.display = 'none'

    // 显示图片和摘要
    this.img.style.display = ''
    this.summary.style.display = ''
    this.copyright.style.display = ''
  }

  /**
   * Handle update requests for the widget.
   */
  async updateNASAImage(): Promise<void> {
    // Use DEMO_KEY if no API key is provided
    const response = await fetch(
      `https://api.nasa.gov/planetary/apod?api_key=${this.apiKey}&date=${this.randomDate()}`
    )
    // 显示旋转图标
    this.refreshbutton.spinner.className = 'fa fa-sync-alt fa-spin' // 开始旋转
    this.spinner.style.display = ''

    // 隐藏图片和摘要，以防止显示旧内容
    this.img.style.display = 'none'
    this.summary.style.display = 'none'
    this.copyright.style.display = 'none'

    if (!response.ok) {
      const data = await response.json()
      if (data.error) {
        this.summary.innerText = data.error.message
      } else {
        this.summary.innerText = response.statusText
      }
      // 隐藏旋转图标
      this.refreshbutton.spinner.className = 'fa fa-sync-alt'
      this.spinner.style.display = 'none'
      this.summary.style.display = ''
      return
    }

    const data = (await response.json()) as INASAResponse

    if (data.media_type === 'image') {
      // Populate the image
      this.img.src = data.url
      this.img.title = data.title
      this.summary.innerText = data.title
      if (data.copyright) {
        this.copyright.innerText = `Copyright: ${data.copyright}`
      }
    } else {
      this.summary.innerText =
        'This random fetch is not an image. Please refresh again.'
      // 隐藏旋转图标
      this.refreshbutton.spinner.className = 'fa fa-sync-alt'
      this.spinner.style.display = 'none'
      this.summary.style.display = ''
    }
  }

  /**
   * Get a random date string in YYYY-MM-DD format.
   */
  randomDate(): string {
    const start = new Date(2010, 1, 1)
    const end = new Date()
    const randomDate = new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    )
    return randomDate.toISOString().slice(0, 10)
  }
}

/**
 * Activate the NASA widget extension.
 */
function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  settingRegistry: ISettingRegistry | null,
  restorer: ILayoutRestorer | null,
  launcher: ILauncher | null
) {
  console.log('JupyterLab extension nasa-daily-pic is activated!')

  // Declare a widget variable
  let widget: MainAreaWidget<NASAWidget>
  let mysettings: ISettingRegistry.ISettings

  //console.log(settingRegistry?.load('nasa-daily-pic:plugin'))
  // Load settings
  if (settingRegistry) {
    settingRegistry
    .load('nasa-daily-pic:plugin')
    .then(settings => {
      mysettings = settings
    }).catch(reason => {
      console.error('failed to load settings for nasa-daily-pic:plugin.', reason)
    })
  }


  // Add an application command
  const command: string = 'nasa:open'
  app.commands.addCommand(command, {
    label: 'Random NASA Picture',
    execute: () => {
      if (!widget || widget.isDisposed) {
        const content = new NASAWidget(mysettings)
        widget = new MainAreaWidget({ content })
        widget.id = 'nasa-pic'
        widget.title.label = 'NASA Picture'
        widget.title.icon = astronautIcon // imageIcon
        widget.title.closable = true
      }
      if (!tracker.has(widget)) {
        // Track the state of the widget for later restoration
        tracker.add(widget)
      }
      if (!widget.isAttached) {
        // Attach the widget to the main work area if it's not there
        app.shell.add(widget, 'main')
      }
      widget.content.updateNASAImage()

      // Add refresh button
      const refreshButton = new ToolbarButton({
        label: 'Refresh',
        icon: refreshIcon,
        onClick: () => widget.content.updateNASAImage()
      })
      widget.toolbar.addItem('refresh', refreshButton)

      // Activate the widget
      app.shell.activateById(widget.id)
    },
    icon: astronautIcon // imageIcon
  })

  // Add the command to the palette.
  palette.addItem({ command, category: 'NASA' })

  // Track and restore the widget state
  const tracker = new WidgetTracker<MainAreaWidget<NASAWidget>>({
    namespace: 'nasa'
  })
  // Track and restore the widget state
  if (restorer) {
    restorer.restore(tracker, {
      command,
      name: () => 'nasa'
    })
  }

  // Add to launcher
  if (launcher) {
    launcher.add({ command, category: 'Other', rank: 1 })
  }
}

/**
 * Initialization data for the nasa-daily-pic extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'nasa-daily-pic:plugin',
  description: 'NASA Picture of the Day',
  autoStart: true,
  requires: [ICommandPalette, ISettingRegistry],
  optional: [ILayoutRestorer, ILauncher],
  activate: activate
}

export default plugin
