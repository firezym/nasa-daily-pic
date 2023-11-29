import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the nasa-daily-pic extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'nasa-daily-pic:plugin',
  description: 'NASA Picture of the Day',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension nasa-daily-pic is activated!');
  }
};

export default plugin;
