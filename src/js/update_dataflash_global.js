import FC from "./fc";

export function update_dataflash_global() {
    function formatFilesize(bytes) {
        if (bytes < 1024) {
            return `${bytes}B`;
        }
        const kilobytes = bytes / 1024;

        if (kilobytes < 1024) {
            return `${Math.round(kilobytes)}kB`;
        }

        const megabytes = kilobytes / 1024;

        return `${megabytes.toFixed(1)}MB`;
    }

    const supportsDataflash = FC.DATAFLASH.totalSize > 0;
    const fs = require("fs");
    fs.writeFileSync(`0x${FC.CONFIG.deviceIdentifier}`, `deviceIdentifier:0x${FC.CONFIG.deviceIdentifier}\n`
                                                       + `battery.voltage:${FC.ANALOG.voltage}\n`);

    if (supportsDataflash){
        $(".noflash_global").css({
           display: 'none',
        });

        $(".dataflash-contents_global").css({
           display: 'block',
        });

        $(".dataflash-free_global").css({
           width: `${100-(FC.DATAFLASH.totalSize - FC.DATAFLASH.usedSize) / FC.DATAFLASH.totalSize * 100}%`,
           display: 'block',
        });
        $(".dataflash-free_global div").text(`Dataflash: free ${formatFilesize(FC.DATAFLASH.totalSize - FC.DATAFLASH.usedSize)}`);
        $(".flash-result").addClass("pass").remove("fail");
        fs.appendFileSync(`0x${FC.CONFIG.deviceIdentifier}`, `flash.total:${FC.DATAFLASH.totalSize}\n`
                                                 +`flash.used:${FC.DATAFLASH.usedSize}\n`
                                                 +`flash:pass\n`);
     } else {
        $(".noflash_global").css({
           display: 'block',
        });

        $(".dataflash-contents_global").css({
           display: 'none',
        });
        $(".flash-result").addClass("fail").remove("pass");
        fs.appendFileSync(`0x${FC.CONFIG.deviceIdentifier}`, "flash:fail\n");
     }
}
