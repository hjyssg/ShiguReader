
import React from 'react';

export interface GlobalContextType {
    file_path_sep?: string;
    server_os?: 'windows' | 'linux';
    has_magick?: boolean;
    server_ip?: string;
    good_folder?: string;
    not_good_folder?: string;
    good_folder_root?: string;
    not_good_folder_root?: string;
    move_pathes?: string[];
    recentAccess?: string[];
    downloadFolder?: string;
}

export const GlobalContext = React.createContext<GlobalContextType>({});

GlobalContext.displayName = "shigureader_global_context";
