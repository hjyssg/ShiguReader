const { expect } = require('chai');

const { normalizeEtcConfig, normalizePathConfig } = require('../config/config-schema');

describe('config-schema', () => {
    describe('normalizeEtcConfig', () => {
        it('keeps the home password under security', () => {
            const { config, errors } = normalizeEtcConfig({ security: { home_password: ' secret ' } });

            expect(errors).to.be.empty;
            expect(config.security.homePassword).to.equal('secret');
            expect(config.home_password).to.equal('secret');
        });

        it('ignores non-string passwords', () => {
            const { config, errors } = normalizeEtcConfig({ home_password: 12345 });

            expect(config.security.homePassword).to.equal('');
            expect(errors).to.have.lengthOf(1);
        });
    });

    describe('normalizePathConfig', () => {
        it('supports the new sectioned format', () => {
            const { config, warnings, errors } = normalizePathConfig({
                paths: {
                    scan: [' /mnt/data ', ''],
                    quick_access: ['C:/Temp', 'C:/Temp'],
                    move_targets: 'D:/Library',
                },
                favorites: {
                    good_root: 'E:/Fav',
                },
            });

            expect(warnings).to.deep.equal(['paths.scan 的第 2 项为空，已忽略。']);
            expect(errors).to.be.empty;
            expect(config.paths.scan).to.deep.equal(['/mnt/data']);
            expect(config.paths.quickAccess).to.deep.equal(['C:/Temp']);
            expect(config.paths.moveTargets).to.deep.equal(['D:/Library']);
            expect(config.favorites.goodRoot).to.equal('E:/Fav');
            expect(config.favorites.notGoodRoot).to.equal('');
        });

        it('maintains compatibility with legacy keys', () => {
            const { config, errors } = normalizePathConfig({
                scan_folder_pathes: 'C:/Comics',
                quick_access_pathes: ['D:/Quick', null],
                move_pathes: ['E:/Move'],
                good_folder_root: 'F:/Good',
                not_good_folder_root: 'G:/Bad',
            });

            expect(errors).to.be.empty;
            expect(config.paths.scan).to.deep.equal(['C:/Comics']);
            expect(config.paths.quickAccess).to.deep.equal(['D:/Quick']);
            expect(config.paths.moveTargets).to.deep.equal(['E:/Move']);
            expect(config.favorites.goodRoot).to.equal('F:/Good');
            expect(config.favorites.notGoodRoot).to.equal('G:/Bad');
        });

        it('collects errors for invalid list entries', () => {
            const { config, errors } = normalizePathConfig({
                paths: {
                    scan: [42],
                },
            });

            expect(config.paths.scan).to.deep.equal([]);
            expect(errors).to.deep.equal(['paths.scan 的第 1 项应为字符串，实际为 number']);
        });
    });
});
