import GUI, { TABS } from '../gui';
import { i18n } from '../localization';

const test = {
};

test.initialize = function (callback) {

    if (GUI.active_tab != 'test') {
        GUI.active_tab = 'test';
    }

    $('#content').load("./tabs/test.html", function () {
        i18n.localizePage();

        GUI.content_ready(callback);
    });
};

test.cleanup = function (callback) {
    if (callback) callback();
};

TABS.test = test;
export {
    test,
};
