/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

/* CoverflowAltTab::Manager
 *
 * This class is a helper class to start the actual switcher.
 */

const Lang = imports.lang;
const Main = imports.ui.main;

function sortWindowsByUserTime(win1, win2) {
    let t1 = win1.get_user_time();
    let t2 = win2.get_user_time();
    return (t2 > t1) ? 1 : -1 ;
}

function matchSkipTaskbar(win) {
    return !win.is_skip_taskbar();
}

function matchWmClass(win) {
    return win.get_wm_class() == this && !win.is_skip_taskbar();
}

function matchWorkspace(win) {
    return win.get_workspace() == this && !win.is_skip_taskbar();
}

function matchMonitor(win ) {
    let compositor = win.get_compositor_private();
    let activeMonitor = this;

    let a = compositor;
    let b = activeMonitor;

    // aabb collision
    if (a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.height + a.y > b.y) {
        return true;
    }

    return false;
}

function Manager(platform, keybinder) {
    this._init(platform, keybinder);
}

Manager.prototype = {
    _init: function(platform, keybinder) {
        this.platform = platform;
        this.keybinder = keybinder;
    },

    enable: function() {
        this.platform.enable();
        this.keybinder.enable(Lang.bind(this, this._startWindowSwitcher));
    },

    disable: function() {
        this.platform.disable();
        this.keybinder.disable();
    },

    activateSelectedWindow: function(win) {
        Main.activateWindow(win, global.get_current_time());
    },

    removeSelectedWindow: function(win) {
        win.delete(global.get_current_time());
    },

    getActiveMonitor: function() {
        let x, y, mask;
        [x, y, mask] = global.get_pointer();
        try {
            for each (var currentMonitor in Main.layoutManager.monitors){
                var minX = currentMonitor.x;
                var minY = currentMonitor.y;
                var maxX = minX + currentMonitor.width;
                var maxY = minY + currentMonitor.height;

                if(x >= minX && x < maxX && y >= minY && y < maxY) {
                    return currentMonitor;
                }
            }
        } catch(e) {
            global.log("caught: " + e);
        }

        return Main.layoutManager.primaryMonitor;
    },

    _startWindowSwitcher: function(display, screen, window, binding) {

        let windows = [];
        let currentWorkspace = screen.get_active_workspace();

        // Construct a list with all windows
        let windowActors = global.get_window_actors();
        for (let i in windowActors)
            windows.push(windowActors[i].get_meta_window());

        windowActors = null;

        switch(binding.get_name()) {
            case 'switch-panels':
                // Switch between windows of all workspaces
                windows = windows.filter( matchSkipTaskbar );
                break;
            case 'switch-group':
                // Switch between windows of same application from all workspaces
                let focused = display.focus_window ? display.focus_window : windows[0];
                windows = windows.filter( matchWmClass, focused.get_wm_class() );
                break;
            default:
                // Switch between windows of current workspace
                windows = windows.filter( matchWorkspace, currentWorkspace );
                break;
        }

        // filter by windows existing on the active monitor
        if(this.platform.getSettings().switch_per_monitor)
        {
            windows = windows.filter ( matchMonitor, this.getActiveMonitor() );
        }

        // Sort by user time
        windows.sort(sortWindowsByUserTime);

        if (windows.length) {
            let mask = binding.get_mask();
            let currentIndex = windows.indexOf(display.focus_window);

            let switcher_class = this.platform.getSettings().switcher_class;
            let switcher = new switcher_class(windows, mask, currentIndex, this);
        }
    }
};
