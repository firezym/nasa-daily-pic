import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette,
  MainAreaWidget,
  WidgetTracker,
  ToolbarButton
} from '@jupyterlab/apputils';

import { ILauncher } from '@jupyterlab/launcher';

import { Widget } from '@lumino/widgets';
import { jupyterIcon, imageIcon, refreshIcon } from '@jupyterlab/ui-components';

interface INASAResponse {
  copyright: string;
  date: string;
  explanation: string;
  media_type: 'video' | 'image';
  title: string;
  url: string;
}

class NASAWidget extends Widget {
  // The image element associated with the widget.
  readonly img: HTMLImageElement;
  // The summary text element associated with the widget.
  readonly summary: HTMLParagraphElement;
  readonly icon: HTMLDivElement;

  /**
   * Construct a new NASA widget.
   */
  constructor() {
    super();

    this.addClass('nasa-widget');

    // Add a summary element to the panel
    this.summary = document.createElement('p');
    this.node.appendChild(this.summary);

    // Add an image element to the panel
    this.img = document.createElement('img');
    this.node.appendChild(this.img);

    // Add a jupyter icon to the panel
    this.icon = document.createElement('div');
    this.node.appendChild(this.icon);
    jupyterIcon.element({
      container: this.icon,
      height: '66px',
      width: '60px',
      marginLeft: '12px'
    });
  }

  /**
   * Handle update requests for the widget.
   */
  async updateNASAImage(): Promise<void> {
    const response = await fetch(
      `https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=${this.randomDate()}`
    );

    if (!response.ok) {
      const data = await response.json();
      if (data.error) {
        this.summary.innerText = data.error.message;
      } else {
        this.summary.innerText = response.statusText;
      }
      return;
    }

    const data = (await response.json()) as INASAResponse;

    if (data.media_type === 'image') {
      // Populate the image
      this.img.src = data.url;
      this.img.title = data.title;
      this.summary.innerText = data.title;
      if (data.copyright) {
        this.summary.innerText += ` (Copyright ${data.copyright})`;
      }
    } else {
      this.summary.innerText = 'This random fetch is not an image.';
    }
  }

  /**
   * Get a random date string in YYYY-MM-DD format.
   */
  randomDate(): string {
    const start = new Date(2010, 1, 1);
    const end = new Date();
    const randomDate = new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
    return randomDate.toISOString().slice(0, 10);
  }
}

/**
 * Activate the NASA widget extension.
 */
function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  restorer: ILayoutRestorer | null,
  launcher: ILauncher | null
) {
  console.log('JupyterLab extension nasa-daily-pic is activated!');

  // Declare a widget variable
  let widget: MainAreaWidget<NASAWidget>;

  // Add an application command
  const command: string = 'nasa:open';
  app.commands.addCommand(command, {
    label: 'Random NASA Picture',
    execute: () => {
      if (!widget || widget.isDisposed) {
        const content = new NASAWidget();
        widget = new MainAreaWidget({ content });
        widget.id = 'nasa-pic';
        widget.title.label = 'NASA Picture';
        widget.title.icon = imageIcon;
        widget.title.closable = true;
      }
      if (!tracker.has(widget)) {
        // Track the state of the widget for later restoration
        tracker.add(widget);
      }
      if (!widget.isAttached) {
        // Attach the widget to the main work area if it's not there
        app.shell.add(widget, 'main');
      }
      widget.content.updateNASAImage();

      // Add refresh button
      const refreshButton = new ToolbarButton({
        label: 'Refresh',
        icon: refreshIcon,
        onClick: () => widget.content.updateNASAImage()
      });
      widget.toolbar.addItem('refresh', refreshButton);

      // Activate the widget
      app.shell.activateById(widget.id);
    },
    icon: imageIcon
  });

  // Add the command to the palette.
  palette.addItem({ command, category: 'NASA' });

  // Track and restore the widget state
  const tracker = new WidgetTracker<MainAreaWidget<NASAWidget>>({
    namespace: 'nasa'
  });
  // Track and restore the widget state
  if (restorer) {
    restorer.restore(tracker, {
      command,
      name: () => 'nasa'
    });
  }

  // Add to launcher
  if (launcher) {
    launcher.add({ command, category: 'Other', rank: 1 });
  }
}

/**
 * Initialization data for the nasa-daily-pic extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'nasa-daily-pic:plugin',
  description: 'NASA Picture of the Day',
  autoStart: true,
  requires: [ICommandPalette],
  optional: [ILayoutRestorer, ILauncher],
  activate: activate
};

export default plugin;
